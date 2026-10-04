/**
 * /admin/team decisions on a Hamza proposal — the ONLY entry point that leads to GitHub writes, and only
 * through the Hamza pipeline (src/lib/hamza/pipeline):
 *   issue_code (step open_pr | merge) → approve (code #1 → feat/* branch + PR) → CI → merge (code #2 + typed
 *   live-branch name, CI green) · reject · refresh_ci · revise (queue a new revision) · revert (merged → revert proposal).
 * Typing «موافق» in the chat never approves anything; neither does WhatsApp.
 */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { publicProposal } from "@/lib/hamza/publicProposal";
import { approveMerge, approveOpenPr, issueCode, refreshCi, rejectProposal, type PipelineResult } from "@/lib/hamza/pipeline";
import { pipelineDeps } from "@/lib/hamza/pipeline/deps";
import { requestRevert } from "@/lib/hamza/revert";
import { requestRevision } from "@/lib/hamza/revise";
import { taskDeps } from "@/lib/hamza/tasks/deps";
import { publicTask, type PublicHamzaTask } from "@/lib/hamza/tasks/types";
import type { ApprovalAction } from "@/lib/hamza/types";
import type { TeamActor } from "./agents";
import { FORBIDDEN_BRANCHES, isValidBranchName, teamGithubConfig } from "./github";
import type { TeamMessage, TeamProposal } from "./types";

export const DECISION_ACTIONS = ["issue_code", "approve", "merge", "reject", "refresh_ci", "revise", "revert"] as const;
export type DecisionAction = (typeof DECISION_ACTIONS)[number];

export type DecisionInput = {
  proposalId: string;
  action: DecisionAction;
  confirm: boolean;
  /** issue_code: which approval step the code is for. */
  step?: ApprovalAction;
  code?: string;
  reviewed?: boolean;
  allowLarge?: boolean;
  /** Feature branch override (open_pr only; feat/ fix/ chore/ docs/ — never the live branch or main). */
  branch?: string;
  /** merge: the live branch name typed by the approver. */
  typedBranch?: string;
  /** revise: what to change. */
  text?: string;
  actor: TeamActor & { ip?: string };
};

export type DecisionResult =
  | { ok: true; proposal: TeamProposal; message?: TeamMessage; code?: string; expiresAt?: string; task?: PublicHamzaTask }
  | { ok: false; status: number; error: string; errorAr: string };

function fail(status: number, error: string, errorAr: string): DecisionResult {
  return { ok: false, status, error, errorAr };
}

function out(result: PipelineResult): DecisionResult {
  if (!result.ok) return fail(result.status, result.error, result.errorAr);
  return { ok: true, proposal: publicProposal(result.proposal), message: result.message, code: result.code, expiresAt: result.expiresAt };
}

/** Feature-branch override: only a new feat/*-style branch, never the live branch or main. */
function branchProblem(branch: string): DecisionResult | null {
  const config = teamGithubConfig();
  if (!isValidBranchName(branch)) return fail(400, "Invalid branch name.", "اسم الفرع غير صالح.");
  if (FORBIDDEN_BRANCHES.includes(branch)) return fail(403, `Writing to ${branch} is blocked from the platform.`, `الكتابة على ${branch} ممنوعة من داخل المنصة.`);
  const allowed = agentCommitBranchCheck(branch, { liveBranch: config.baseBranch });
  return allowed.ok ? null : fail(403, allowed.reason, allowed.reasonAr);
}

export async function decideProposal(input: DecisionInput): Promise<DecisionResult> {
  if (!input.confirm) return fail(400, "Explicit confirmation required.", "يلزم تأكيد صريح.");
  const deps = pipelineDeps();
  const actor = input.actor;
  const branch = input.branch?.trim();
  if (branch && (input.action === "approve" || input.action === "issue_code")) {
    const problem = branchProblem(branch);
    if (problem) return problem;
  }
  switch (input.action) {
    case "issue_code":
      return out(await issueCode(deps, { proposalId: input.proposalId, action: input.step === "merge" ? "merge" : "open_pr", actor, branch }));
    case "approve": {
      const current = await deps.repo.getProposal(input.proposalId);
      if (branch && current && branch !== current.targetBranch) {
        return fail(409, "The branch changed: request a new approval code for it.", "تغيّر الفرع: اطلب رمز موافقة جديداً له.");
      }
      return out(await approveOpenPr(deps, { proposalId: input.proposalId, code: input.code ?? "", reviewed: input.reviewed === true, allowLarge: input.allowLarge, actor }));
    }
    case "merge":
      return out(await approveMerge(deps, { proposalId: input.proposalId, code: input.code ?? "", typedBranch: input.typedBranch ?? "", actor }));
    case "reject":
      return out(await rejectProposal(deps, { proposalId: input.proposalId, actor }));
    case "refresh_ci":
      return out(await refreshCi(deps, { proposalId: input.proposalId }));
    case "revert":
      return out(await requestRevert(deps, { proposalId: input.proposalId, actor }));
    case "revise": {
      const revised = await requestRevision({ ...taskDeps(), repo: deps.repo }, { proposalId: input.proposalId, text: input.text ?? "", actor });
      if (!revised.ok) return fail(revised.status, revised.error, revised.errorAr);
      return { ok: true, proposal: publicProposal(revised.proposal), message: revised.message, task: publicTask(revised.task) };
    }
  }
}
