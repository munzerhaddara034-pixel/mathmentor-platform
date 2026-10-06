/** Approval #1: verify the code, then branch + one atomic commit + Pull Request into the live branch. */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { staticFindings } from "@/lib/team/codeChecks";
import type { TeamProposal, TeamProposalFile } from "@/lib/team/types";
import type { HamzaGithubWriter, PrInfo } from "../github/types";
import { proposalTier } from "../limits";
import { addEvent } from "../timeline";
import type { HamzaPipelineState } from "../types";
import { verifyStepCode } from "./verifyStep";
import {
  conflictCheck,
  fail,
  postSystem,
  proposalDiffHash,
  save,
  shortList,
  stateOf,
  treeWrites,
  type PipelineActor,
  type PipelineDeps,
  type PipelineResult,
} from "./shared";

export type OpenPrInput = { proposalId: string; code: string; reviewed: boolean; allowLarge?: boolean; actor: PipelineActor };

function addedLines(diff: string): string[] {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

/** Guards re-run on the stored content right before the write (defence in depth). */
export function preWriteFindings(files: TeamProposalFile[], allowLarge: boolean): string[] {
  const findings = staticFindings(
    files
      .filter((file) => file.change !== "delete")
      .map((file) => ({ path: file.path, content: file.newContent, addedLines: addedLines(file.diff) })),
  );
  const tier = proposalTier(files);
  if (!tier.ok) findings.push(tier.reasonAr);
  else if (tier.tier === "large" && !allowLarge) findings.push(`تعديل كبير (${tier.files} ملف / ${tier.lines} سطر): فعّل خيار «تعديل كبير» صراحةً.`);
  return findings;
}

function prBody(proposal: TeamProposal, state: HamzaPipelineState, actor: PipelineActor, codeHash: string): string {
  return [
    `**Hamza (in-platform developer agent) — proposal \`${proposal.id}\` rev ${state.revision}**`,
    "",
    proposal.summaryAr || proposal.commitMessage,
    "",
    proposal.risksAr ? `**Risks:** ${proposal.risksAr}` : "",
    proposal.testPlanAr ? `**Test plan:** ${proposal.testPlanAr}` : "",
    "",
    `- Requested by: ${proposal.requestedBy}`,
    `- Approval #1 by: ${actor.name} (code ${codeHash.slice(0, 8)}…)`,
    `- Diff hash: \`${state.diffHash.slice(0, 16)}\` · tier ${state.tier} · risk ${state.riskLevel}`,
    `- Files: ${shortList(proposal.files)}`,
    "",
    "Merging needs Approval #2 in /admin/team after the `hamza-ci` check is green.",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n");
}

async function writeBranchAndPr(
  deps: PipelineDeps,
  github: HamzaGithubWriter,
  proposal: TeamProposal,
  state: HamzaPipelineState,
  input: OpenPrInput,
  codeHash: string,
): Promise<{ commitSha: string; commitUrl: string; pr: PrInfo; reused: boolean }> {
  const base = deps.config.baseBranch.branch;
  const branch = proposal.targetBranch;
  const baseSha = await github.getBranchSha(base);
  if (!baseSha) throw new Error(`Base branch ${base} not found on GitHub.`);
  let parentSha = await github.getBranchSha(branch);
  if (!parentSha) {
    // Always from the CURRENT live head: the conflict guard below then proves the patch still applies.
    await github.createBranch(branch, baseSha);
    parentSha = await github.getBranchSha(branch);
    if (!parentSha) throw new Error(`Could not create ${branch}.`);
  }
  const conflict = await conflictCheck(github, branch, proposal.files);
  if (conflict) throw new Error(`الملف ${conflict} تغيّر على ${branch} منذ اقتراح الـ Diff — اطلب Diff جديداً.`);
  const message = `${proposal.commitMessage}\n\nApproved in /admin/team by ${input.actor.name}. Proposal ${proposal.id} rev ${state.revision}.`;
  const commit = await github.commitTree({ branch, parentSha, message, files: treeWrites(proposal.files) });
  const existing = (state.prNumber ? await github.getPr(state.prNumber) : null) ?? (await github.findOpenPrByHead(branch));
  if (existing && existing.state === "open") return { commitSha: commit.sha, commitUrl: commit.url, pr: { ...existing, headSha: commit.sha }, reused: true };
  const pr = await github.openPr({ head: branch, base, title: proposal.commitMessage, body: prBody(proposal, state, input.actor, codeHash) });
  return { commitSha: commit.sha, commitUrl: commit.url, pr: { ...pr, headSha: commit.sha }, reused: false };
}

export async function approveOpenPr(deps: PipelineDeps, input: OpenPrInput): Promise<PipelineResult> {
  if (!deps.canApprove(input.actor)) return fail(403, "Not an approver.", "حسابك غير مخوّل بالموافقة على الـ Diff (TEAM_APPROVER_EMAILS).");
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  if (!["pending", "failed"].includes(proposal.status)) return fail(409, "Proposal is no longer pending.", "هذا الـ Diff لم يعد بانتظار قرار.", proposal);
  if (!input.reviewed) return fail(400, "Confirm that you reviewed the diff.", "أكّد أنك راجعت الـ Diff.", proposal);
  const state = stateOf(proposal);
  if (state.diffHash !== proposalDiffHash(proposal.files)) return fail(409, "Stored diff does not match its hash.", "الـ Diff المخزَّن لا يطابق بصمته.", proposal);
  const base = deps.config.baseBranch.branch;
  const branch = proposal.targetBranch;
  const policy = agentCommitBranchCheck(branch, { liveBranch: base });
  if (!policy.ok || deps.config.liveBranches.includes(branch)) {
    return fail(403, policy.ok ? `Writing to ${branch} is blocked.` : policy.reason, policy.ok ? `الكتابة على ${branch} ممنوعة.` : policy.reasonAr, proposal);
  }
  const verified = await verifyStepCode(deps, proposal, state, { action: "open_pr", code: input.code, targetBranch: branch, actor: input.actor });
  if (!verified.ok) return verified;
  const findings = preWriteFindings(proposal.files, Boolean(input.allowLarge));
  if (findings.length) return fail(422, "Proposal failed safety checks.", findings.join(" · "), proposal);

  const now = deps.now();
  const lockedState = addEvent({ ...state, codes: { ...state.codes, open_pr: verified.used } }, "approved_pr", now, input.actor.name);
  const locked = await save(deps, proposal, ["pending", "failed"], "committing", { hamza: lockedState, decidedBy: input.actor.name, decidedAt: now.toISOString() });
  if (!locked) return fail(409, "Proposal is no longer pending.", "هذا الـ Diff قيد التنفيذ أو حُسم مسبقاً.");
  await deps.audit("hamza.approve.pr", {
    actor: input.actor,
    ip: input.actor.ip,
    details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, branch, baseBranch: base },
  });
  try {
    const github = deps.writer();
    const written = await writeBranchAndPr(deps, github, locked, lockedState, input, verified.used.hash);
    const after = deps.now();
    let next: HamzaPipelineState = {
      ...lockedState,
      prNumber: written.pr.number,
      prUrl: written.pr.url,
      headSha: written.commitSha,
      ci: { state: "pending", headSha: written.commitSha, checks: [], checkedAt: after.toISOString() },
      lastError: undefined,
    };
    next = addEvent(addEvent(next, "pr_opened", after, undefined, `#${written.pr.number}`), "ci_running", after);
    const opened =
      (await save(deps, locked, ["committing"], "ci_running", {
        hamza: next,
        committedBranch: branch,
        commitSha: written.commitSha,
        commitUrl: written.commitUrl,
        error: undefined,
      })) ?? locked;
    await deps.audit(written.reused ? "hamza.pr.updated" : "hamza.pr.opened", {
      actor: input.actor,
      ip: input.actor.ip,
      details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, branch, baseBranch: base, sha: written.commitSha, prNumber: written.pr.number },
    });
    const text = [
      `✅ موافقة #1 من ${input.actor.name}: ${written.reused ? "حُدِّث" : "فُتح"} PR #${written.pr.number} → ${base}`,
      `- الفرع: ${branch} · SHA: ${written.commitSha.slice(0, 7)}`,
      `- الملفات: ${shortList(proposal.files)}`,
      `- فحص CI (tsc · الاختبارات · البناء) يعمل الآن على GitHub Actions، وسأنشر النتيجة هنا.`,
      `- لا شيء يُدمج في ${base} قبل نجاح CI والموافقة الثانية (رمز منفصل).`,
      `- ${written.pr.url}`,
    ].join("\n");
    const message = await postSystem(deps, opened, text);
    return { ok: true, proposal: opened, message };
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "GitHub error";
    const failedState = addEvent({ ...lockedState, lastError: reason }, "failed", deps.now(), undefined, reason);
    const failed = (await save(deps, locked, ["committing"], "failed", { hamza: failedState, error: reason })) ?? locked;
    const message = await postSystem(deps, failed, `⚠️ تعذّر فتح الـ PR على ${branch}: ${reason}\nلم يُدمج شيء. يمكنك طلب رمز جديد وإعادة المحاولة أو الرفض.`);
    return { ok: true, proposal: failed, message };
  }
}
