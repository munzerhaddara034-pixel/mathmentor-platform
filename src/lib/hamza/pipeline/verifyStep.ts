/** Shared code verification for both approval steps (persists attempts; audits failures). */
import type { TeamProposal } from "@/lib/team/types";
import { CODE_FAILURE_TEXT, verifyApprovalCode } from "../codes";
import type { ApprovalAction, CodeBinding, HamzaPipelineState, StoredApprovalCode } from "../types";
import { fail, save, type PipelineActor, type PipelineDeps, type PipelineFail } from "./shared";

export async function verifyStepCode(
  deps: PipelineDeps,
  proposal: TeamProposal,
  state: HamzaPipelineState,
  input: { action: ApprovalAction; code: string; targetBranch: string; actor: PipelineActor },
): Promise<{ ok: true; used: StoredApprovalCode } | PipelineFail> {
  const binding: CodeBinding = {
    proposalId: proposal.id,
    revision: state.revision,
    diffHash: state.diffHash,
    action: input.action,
    targetBranch: input.targetBranch,
  };
  const result = verifyApprovalCode(state.codes[input.action], {
    code: input.code,
    binding,
    now: deps.now(),
    maxAttempts: deps.config.maxCodeAttempts,
  });
  if (result.ok) return { ok: true, used: result.stored };
  if (result.stored) {
    await save(deps, proposal, [proposal.status], proposal.status, { hamza: { ...state, codes: { ...state.codes, [input.action]: result.stored } } });
  }
  await deps.audit("hamza.code.failed", {
    actor: input.actor,
    ip: input.actor.ip,
    details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, reason: result.reason, result: input.action },
  });
  const text = CODE_FAILURE_TEXT[result.reason];
  return fail(result.reason === "mismatch" || result.reason === "missing" ? 403 : 409, text.en, text.ar, proposal);
}
