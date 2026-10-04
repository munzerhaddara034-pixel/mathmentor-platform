/**
 * Runs one claimed Hamza task end-to-end: snapshot → agent loop → proposal / revision / reply / pause / failure,
 * with progress, cost and audit recorded on the way. Never writes to GitHub (the approval pipeline does that).
 */
import { createId } from "@/lib/ids";
import { runAgentLoop } from "../agent/loop";
import { agentProtocol } from "../agent/protocol";
import type { AgentOutcome } from "../agent/types";
import { beirutMonth } from "../cost";
import { createRepoTools } from "../tools";
import type { HamzaTask } from "../tasks/types";
import { hamzaMessage, proposalText, usd } from "./messages";
import { REVISABLE_STATUSES, newProposal, revisionPatch } from "./proposalFromDraft";
import type { RunnerDeps } from "./types";
import { revisionBrief } from "./revisionBrief";

const LEASE_MS = 5 * 60_000;

async function finish(deps: RunnerDeps, task: HamzaTask, status: HamzaTask["status"], patch: Partial<HamzaTask>): Promise<HamzaTask | undefined> {
  const now = deps.now().toISOString();
  const terminal = status === "done" || status === "failed" || status === "cancelled";
  return deps.tasks.update(task.id, ["running"], { status, ...patch, lockedBy: undefined, lockedUntil: undefined, ...(terminal ? { finishedAt: now } : {}) });
}

async function deliver(deps: RunnerDeps, task: HamzaTask, outcome: AgentOutcome, ctx: { ref: string; sha: string }): Promise<void> {
  const now = deps.now();
  const base = deps.config.baseBranch.branch;
  const common = { cost: outcome.cost, progress: { steps: outcome.steps, toolCalls: outcome.toolCalls, model: outcome.cost.models.at(-1) } };
  if (outcome.kind === "proposal") {
    const existing = task.proposalId ? await deps.teamRepo.getProposal(task.proposalId) : undefined;
    if (task.proposalId && existing) {
      const patch = revisionPatch({ existing, draft: outcome.draft, headSha: ctx.sha, cost: outcome.cost, task, now });
      const revised = await deps.teamRepo.transitionProposal(existing.id, REVISABLE_STATUSES, patch);
      if (!revised) {
        await deps.teamRepo.addMessage(hamzaMessage(task, `لم أستطع تحديث الاقتراح ${existing.id}: حالته تغيّرت (${existing.status}).`, now));
        await finish(deps, task, "failed", { ...common, result: { kind: "failed", message: "proposal status changed" } });
        return;
      }
      const message = hamzaMessage(task, proposalText({ replyAr: outcome.draft.replyAr, branch: revised.targetBranch, base, files: revised.files, cost: outcome.cost.usd, revision: revised.hamza?.revision }), now, { proposalId: revised.id });
      await deps.teamRepo.addMessage(message);
      await deps.audit("hamza.proposal.created", { details: { proposalId: revised.id, taskId: task.id, revision: revised.hamza?.revision, diffHash: revised.hamza?.diffHash, branch: revised.targetBranch, usd: outcome.cost.usd, result: "revision" } });
      await finish(deps, task, "done", { ...common, result: { kind: "proposal", proposalId: revised.id, messageId: message.id } });
      return;
    }
    const messageId = createId("tmsg");
    const proposal = newProposal({ draft: outcome.draft, task, baseBranch: base, baseSha: ctx.sha, messageId, cost: outcome.cost, now });
    await deps.teamRepo.saveProposal(proposal);
    const message = hamzaMessage(task, proposalText({ replyAr: outcome.draft.replyAr, branch: proposal.targetBranch, base, files: proposal.files, cost: outcome.cost.usd }), now, { id: messageId, proposalId: proposal.id, notice: deps.modelNotice });
    await deps.teamRepo.addMessage(message);
    await deps.audit("hamza.proposal.created", { details: { proposalId: proposal.id, taskId: task.id, revision: 1, diffHash: proposal.hamza?.diffHash, branch: proposal.targetBranch, baseBranch: base, sha: ctx.sha, usd: outcome.cost.usd, model: outcome.cost.models.join(",") } });
    await finish(deps, task, "done", { ...common, result: { kind: "proposal", proposalId: proposal.id, messageId } });
    return;
  }
  if (outcome.kind === "reply") {
    const message = hamzaMessage(task, outcome.text, now, { notice: deps.modelNotice });
    await deps.teamRepo.addMessage(message);
    await finish(deps, task, "done", { ...common, result: { kind: "reply", messageId: message.id } });
    return;
  }
  if (outcome.kind === "paused") {
    const month = outcome.reason === "month_budget";
    const text = month
      ? `⏸️ توقفت: وصل إنفاق حمزة هذا الشهر إلى الحد (${usd(deps.config.budgets.monthlyUsd)}). يحتاج منذر رفع HAMZA_MONTHLY_BUDGET_USD.`
      : `⏸️ توقفت عند ${usd(outcome.cost.usd)} (حد المهمة ${usd(task.capUsd)}). اضغط «متابعة حتى ${usd(deps.config.budgets.taskMaxUsd)}» في بطاقة المهمة أو ألغِها.`;
    const message = hamzaMessage(task, text, now);
    await deps.teamRepo.addMessage(message);
    await deps.audit("hamza.budget.stop", { details: { taskId: task.id, usd: outcome.cost.usd, reason: outcome.reason } });
    // A monthly stop is terminal (it would otherwise block the channel until the 1st); a task-cap pause is resumable.
    await finish(deps, task, month ? "failed" : "budget_paused", { ...common, pauseReason: outcome.reason, checkpoint: outcome.checkpoint, result: { kind: "paused", messageId: message.id, message: outcome.message } });
    return;
  }
  const cancelled = outcome.reason === "cancelled";
  const message = hamzaMessage(task, cancelled ? "أُلغيت المهمة. لم يُقترح أي تعديل." : `⚠️ لم أكمل المهمة: ${outcome.message}`, now);
  await deps.teamRepo.addMessage(message);
  await deps.audit(cancelled ? "hamza.task.cancelled" : "hamza.task.failed", { details: { taskId: task.id, usd: outcome.cost.usd, reason: outcome.reason } });
  await finish(deps, task, cancelled ? "cancelled" : "failed", { ...common, result: { kind: cancelled ? "cancelled" : "failed", messageId: message.id, message: outcome.message } });
}

export async function runHamzaTask(deps: RunnerDeps, task: HamzaTask): Promise<void> {
  const config = deps.config;
  try {
    const target = task.proposalId ? await deps.teamRepo.getProposal(task.proposalId) : undefined;
    if (task.proposalId && !target) throw new Error(`Proposal ${task.proposalId} not found.`);
    const ref = target?.hamza?.prNumber ? target.targetBranch : config.baseBranch.branch;
    const snapshot = await deps.openSnapshot(ref);
    const tools = createRepoTools({ snapshot, github: deps.reader() ?? undefined, ciChecks: config.ciChecks });
    const brief = target ? revisionBrief(task, target, ref) : undefined;
    const system = [deps.systemPrompt, agentProtocol({ repo: deps.repoLabel, base: ref, sha: snapshot.sha, maxToolCalls: config.limits.maxToolCalls, revision: brief }), task.extraContext ?? ""]
      .filter(Boolean)
      .join("\n\n");
    const month = beirutMonth(deps.now());
    const outcome = await runAgentLoop(
      {
        call: deps.call,
        tools,
        snapshot,
        nowMs: () => deps.now().getTime(),
        monthSpentUsd: () => deps.tasks.monthSpentUsd(month.startIso),
        isCancelled: async () => Boolean((await deps.tasks.get(task.id))?.cancelRequested),
        syntax: deps.syntax,
        onStep: async (step, checkpoint) => {
          await deps.tasks.addStep(task.id, step);
          await deps.tasks.update(task.id, ["running"], {
            cost: checkpoint.cost,
            progress: { steps: checkpoint.steps, toolCalls: checkpoint.toolCalls, lastStep: step.summary.slice(0, 160), model: step.model },
            lockedUntil: new Date(deps.now().getTime() + LEASE_MS).toISOString(),
          });
        },
      },
      {
        maxSteps: config.limits.maxSteps,
        maxToolCalls: config.limits.maxToolCalls,
        timeoutMs: config.limits.taskTimeoutMinutes * 60_000,
        maxPatchRounds: 3,
        taskCapUsd: task.capUsd,
        monthCapUsd: config.budgets.monthlyUsd,
      },
      { system, turns: task.turns, resume: task.checkpoint, estimateUsd: task.estimateUsd },
    );
    await deliver(deps, task, outcome, { ref, sha: snapshot.sha });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "error";
    await deps.teamRepo.addMessage(hamzaMessage(task, `⚠️ تعذّر تشغيل المهمة: ${reason}`, deps.now()));
    await deps.audit("hamza.task.failed", { details: { taskId: task.id, reason } });
    await finish(deps, task, "failed", { result: { kind: "failed", message: reason } });
  }
}

export const HAMZA_TASK_LEASE_MS = LEASE_MS;
