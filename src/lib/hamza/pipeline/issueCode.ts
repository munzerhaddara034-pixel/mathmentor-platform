/** Issue an approval code for one step of one proposal revision (shown once to the approver in the app). */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import type { TeamProposalStatus } from "@/lib/team/types";
import { issueApprovalCode } from "../codes";
import { addEvent } from "../timeline";
import type { ApprovalAction, CodeBinding } from "../types";
import { fail, proposalDiffHash, save, stateOf, type PipelineActor, type PipelineDeps, type PipelineResult } from "./shared";

const STEP_STATUSES: Record<ApprovalAction, TeamProposalStatus[]> = {
  open_pr: ["pending", "failed"],
  merge: ["ci_passed"],
};

export async function issueCode(
  deps: PipelineDeps,
  input: { proposalId: string; action: ApprovalAction; actor: PipelineActor; branch?: string },
): Promise<PipelineResult> {
  const allowed = input.action === "merge" ? deps.canMerge(input.actor) : deps.canApprove(input.actor);
  if (!allowed) return fail(403, "Not an approver for this step.", "حسابك غير مخوّل بهذه الموافقة.");
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  if (!STEP_STATUSES[input.action].includes(proposal.status)) {
    return fail(409, "This step is not available in the current state.", "هذه الخطوة غير متاحة في الحالة الحالية.", proposal);
  }
  const state = stateOf(proposal);
  if (state.diffHash !== proposalDiffHash(proposal.files)) {
    return fail(409, "Stored diff does not match its hash. Ask Hamza for a new revision.", "الـ Diff المخزَّن لا يطابق بصمته. اطلب نسخة جديدة.", proposal);
  }
  const base = deps.config.baseBranch.branch;
  let targetBranch = proposal.targetBranch;
  if (input.action === "open_pr" && input.branch && input.branch.trim() !== proposal.targetBranch && !state.prNumber) {
    const branch = input.branch.trim();
    const check = agentCommitBranchCheck(branch, { liveBranch: base });
    if (!check.ok || deps.config.liveBranches.includes(branch)) {
      return fail(403, check.ok ? `Writing to ${branch} is blocked.` : check.reason, check.ok ? `الكتابة على ${branch} ممنوعة.` : check.reasonAr, proposal);
    }
    targetBranch = branch;
  }
  const now = deps.now();
  const binding: CodeBinding = {
    proposalId: proposal.id,
    revision: state.revision,
    diffHash: state.diffHash,
    action: input.action,
    targetBranch: input.action === "merge" ? base : targetBranch,
  };
  const { code, stored } = issueApprovalCode(binding, { now, ttlMinutes: deps.config.codeTtlMinutes, issuedTo: input.actor.email });
  const next = addEvent({ ...state, codes: { ...state.codes, [input.action]: stored } }, "code_issued", now, input.actor.name, input.action);
  const updated = await save(deps, proposal, [proposal.status], proposal.status, { hamza: next, targetBranch });
  if (!updated) return fail(409, "Proposal changed meanwhile. Reload.", "تغيّرت حالة الـ Diff. أعد التحميل.");
  await deps.audit("hamza.code.issued", {
    actor: input.actor,
    ip: input.actor.ip,
    details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, branch: binding.targetBranch, result: input.action },
  });
  return { ok: true, proposal: updated, code, expiresAt: stored.expiresAt };
}
