/** Approval #2: separate code + typed live-branch name, only when CI is green on the exact PR head. */
import type { TeamProposal } from "@/lib/team/types";
import { summarizeChecks } from "../ci";
import { addEvent } from "../timeline";
import type { HamzaPipelineState } from "../types";
import { verifyStepCode } from "./verifyStep";
import { fail, postSystem, save, stateOf, type PipelineActor, type PipelineDeps, type PipelineResult } from "./shared";

export type MergeInput = { proposalId: string; code: string; typedBranch: string; actor: PipelineActor };

async function stillGreen(deps: PipelineDeps, state: HamzaPipelineState): Promise<string | null> {
  if (!state.prNumber || !state.headSha) return "No PR.";
  const github = deps.reader();
  const pr = await github.getPr(state.prNumber);
  if (!pr || pr.state !== "open") return "The PR is not open any more.";
  if (pr.headSha !== state.headSha) return "New commits were pushed to the PR after CI; wait for CI on the new head.";
  if (pr.baseRef !== deps.config.baseBranch.branch) return `The PR targets ${pr.baseRef}, not ${deps.config.baseBranch.branch}.`;
  const summary = summarizeChecks({ runs: await github.listCheckRuns(state.headSha), required: deps.config.ciChecks, headSha: state.headSha, now: deps.now() });
  return summary.state === "passed" ? null : `CI is ${summary.state} on ${state.headSha.slice(0, 7)}.`;
}

async function markRevertedOriginal(deps: PipelineDeps, revert: TeamProposal, actor: PipelineActor): Promise<void> {
  const originalId = revert.hamza?.revertOf;
  if (!originalId) return;
  const original = await deps.repo.getProposal(originalId);
  if (!original) return;
  const state = addEvent({ ...stateOf(original), reverted: true, revertProposalId: revert.id }, "reverted", deps.now(), actor.name, revert.id);
  await save(deps, original, [original.status], original.status, { hamza: state });
  await deps.audit("hamza.revert.merged", { actor, ip: actor.ip, details: { proposalId: originalId, prNumber: revert.hamza?.prNumber, sha: revert.hamza?.mergeSha } });
}

export async function approveMerge(deps: PipelineDeps, input: MergeInput): Promise<PipelineResult> {
  if (!deps.canMerge(input.actor)) return fail(403, "Not allowed to merge to live.", "حسابك غير مخوّل بالدمج في الفرع الحيّ.");
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  if (proposal.status !== "ci_passed") return fail(409, "Merge is only possible after CI passed.", "الدمج متاح فقط بعد نجاح CI.", proposal);
  const base = deps.config.baseBranch.branch;
  if (input.typedBranch.trim() !== base) return fail(400, `Type the live branch name exactly: ${base}`, `اكتب اسم الفرع الحيّ حرفياً: ${base}`, proposal);
  const state = stateOf(proposal);
  const verified = await verifyStepCode(deps, proposal, state, { action: "merge", code: input.code, targetBranch: base, actor: input.actor });
  if (!verified.ok) return verified;
  const notGreen = await stillGreen(deps, state);
  if (notGreen) {
    const back = await save(deps, proposal, ["ci_passed"], "ci_running", { hamza: { ...state, codes: { ...state.codes, merge: verified.used }, lastError: notGreen } });
    return fail(409, notGreen, `لا يمكن الدمج الآن: ${notGreen}`, back);
  }
  const now = deps.now();
  const lockedState = addEvent({ ...state, codes: { ...state.codes, merge: verified.used } }, "approved_merge", now, input.actor.name);
  const locked = await save(deps, proposal, ["ci_passed"], "merging", { hamza: lockedState });
  if (!locked) return fail(409, "Proposal changed meanwhile.", "تغيّرت حالة الـ Diff.");
  const details = { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, branch: base, prNumber: state.prNumber, sha: state.headSha };
  await deps.audit("hamza.approve.merge", { actor: input.actor, ip: input.actor.ip, details });
  try {
    const merged = await deps.writer().mergePr({
      prNumber: state.prNumber as number,
      sha: state.headSha as string,
      title: `${proposal.commitMessage} (#${state.prNumber})`,
      message: `Hamza proposal ${proposal.id} rev ${state.revision}. Approval #1: ${proposal.decidedBy ?? "?"} · Approval #2: ${input.actor.name}.`,
    });
    const doneAt = deps.now();
    const next = addEvent({ ...lockedState, mergeSha: merged.sha, mergedAt: doneAt.toISOString(), mergedBy: input.actor.name, lastError: undefined }, "merged", doneAt, input.actor.name);
    const done = (await save(deps, locked, ["merging"], "merged", { hamza: next })) ?? locked;
    await deps.audit("hamza.merged", { actor: input.actor, ip: input.actor.ip, details: { ...details, sha: merged.sha } });
    await markRevertedOriginal(deps, done, input.actor);
    const message = await postSystem(
      deps,
      done,
      `🚀 دُمج PR #${state.prNumber} في ${base} بموافقة ${input.actor.name} (squash ${merged.sha.slice(0, 7)}). Render سيعيد النشر تلقائياً.\nإذا ظهرت مشكلة: زر «تراجع» يفتح PR عكسي يمرّ بنفس CI والموافقة.`,
    );
    return { ok: true, proposal: done, message };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "merge failed";
    const back = (await save(deps, locked, ["merging"], "ci_passed", { hamza: { ...lockedState, lastError: reason } })) ?? locked;
    await deps.audit("hamza.merge.failed", { actor: input.actor, ip: input.actor.ip, details: { ...details, reason } });
    const message = await postSystem(deps, back, `⚠️ تعذّر الدمج: ${reason}\nلم يتغيّر الفرع الحيّ.`);
    return { ok: true, proposal: back, message };
  }
}
