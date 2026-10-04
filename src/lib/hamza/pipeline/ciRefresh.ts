/** Poll CI for a proposal's PR head, store the summary, and post the terminal result in the chat once. */
import type { TeamProposal, TeamProposalStatus } from "@/lib/team/types";
import { extractErrorLines, failingJobIds, formatCiReport, summarizeChecks } from "../ci";
import { addEvent } from "../timeline";
import type { CiSummary, HamzaPipelineState } from "../types";
import { fail, postSystem, save, stateOf, type PipelineDeps, type PipelineResult } from "./shared";

const CI_STATUSES: TeamProposalStatus[] = ["ci_running", "ci_failed", "ci_passed"];

function statusFor(summary: CiSummary): TeamProposalStatus {
  return summary.state === "passed" ? "ci_passed" : summary.state === "failed" ? "ci_failed" : "ci_running";
}

function waitingSince(state: HamzaPipelineState): number | undefined {
  const event = [...state.timeline].reverse().find((item) => item.kind === "pr_opened" || item.kind === "ci_running");
  return event ? Date.parse(event.at) : undefined;
}

async function excerpt(deps: PipelineDeps, summary: CiSummary, runs: Parameters<typeof failingJobIds>[0]): Promise<string | undefined> {
  const [jobId] = failingJobIds(runs, deps.config.ciChecks);
  if (!jobId) return undefined;
  const log = await deps.reader().getJobLog(jobId);
  return log ? extractErrorLines(log, 30) : undefined;
}

export async function refreshCi(deps: PipelineDeps, input: { proposalId: string }): Promise<PipelineResult> {
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  const state = stateOf(proposal);
  if (!CI_STATUSES.includes(proposal.status) || !state.prNumber || !state.headSha) {
    return fail(409, "No PR waiting for CI.", "لا يوجد PR بانتظار CI.", proposal);
  }
  const github = deps.reader();
  const pr = await github.getPr(state.prNumber);
  // Someone pushed to the PR branch outside Hamza: CI (and the merge code) now refer to the new head.
  const headSha = pr && pr.headSha !== state.headSha ? pr.headSha : state.headSha;
  const runs = await github.listCheckRuns(headSha);
  const now = deps.now();
  const summary = summarizeChecks({ runs, required: deps.config.ciChecks, headSha, now, waitingSinceMs: waitingSince(state) });
  if (summary.state === "failed") summary.errorExcerpt = await excerpt(deps, summary, runs);
  const terminal = summary.state === "passed" || summary.state === "failed" || summary.state === "missing";
  const alreadyReported = state.ci?.reportedAt && state.ci.state === summary.state && state.ci.headSha === headSha;
  let next: HamzaPipelineState = { ...state, headSha, ci: { ...summary, reportedAt: alreadyReported ? state.ci?.reportedAt : undefined } };
  if (headSha !== state.headSha) next = addEvent(next, "revised", now, undefined, `external push ${headSha.slice(0, 7)}`);
  const report = terminal && !alreadyReported;
  if (report) {
    next = { ...next, ci: { ...summary, reportedAt: now.toISOString() } };
    if (summary.state !== "missing") next = addEvent(next, summary.state === "passed" ? "ci_passed" : "ci_failed", now);
  }
  const status = statusFor(summary);
  const updated = await save(deps, proposal, CI_STATUSES, status, { hamza: next });
  if (!updated) return fail(409, "Proposal changed meanwhile.", "تغيّرت حالة الـ Diff.");
  if (!report) return { ok: true, proposal: updated };
  await deps.audit("hamza.ci.result", {
    details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, branch: proposal.targetBranch, sha: headSha, prNumber: state.prNumber, result: summary.state },
  });
  const repairNote = summary.state === "failed" && deps.onCiFailed ? await deps.onCiFailed(updated) : undefined;
  const message = await postSystem(deps, updated, formatCiReport({ summary, prNumber: state.prNumber, prUrl: state.prUrl, repairNote }));
  const latest = (await deps.repo.getProposal(proposal.id)) ?? updated;
  return { ok: true, proposal: latest, message };
}

/** Proposals the worker should poll (CI not yet terminal). */
export function needsCiPoll(proposal: TeamProposal): boolean {
  return proposal.status === "ci_running" && Boolean(proposal.hamza?.prNumber);
}
