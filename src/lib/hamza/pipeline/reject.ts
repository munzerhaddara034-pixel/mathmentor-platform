/** Reject a proposal (any open state). An open Hamza PR is closed, never merged. */
import { addEvent } from "../timeline";
import { fail, postSystem, save, stateOf, type PipelineActor, type PipelineDeps, type PipelineResult } from "./shared";

export async function rejectProposal(deps: PipelineDeps, input: { proposalId: string; actor: PipelineActor }): Promise<PipelineResult> {
  if (!deps.canApprove(input.actor)) return fail(403, "Not an approver.", "حسابك غير مخوّل.");
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  const state = stateOf(proposal);
  const now = deps.now();
  const updated = await save(deps, proposal, ["pending", "failed", "ci_running", "ci_failed", "ci_passed"], "rejected", {
    hamza: addEvent({ ...state, codes: {} }, "rejected", now, input.actor.name),
    decidedBy: input.actor.name,
    decidedAt: now.toISOString(),
  });
  if (!updated) return fail(409, "Proposal is no longer open.", "هذا الـ Diff لم يعد بانتظار قرار.", proposal);
  let closed = "";
  if (state.prNumber) {
    try {
      await deps.writer().closePr(state.prNumber);
      closed = ` وأُغلق PR #${state.prNumber} بدون دمج`;
    } catch {
      closed = ` (تعذّر إغلاق PR #${state.prNumber} تلقائياً — أغلقه من GitHub)`;
    }
  }
  await deps.audit("hamza.rejected", { actor: input.actor, ip: input.actor.ip, details: { proposalId: proposal.id, revision: state.revision, diffHash: state.diffHash, prNumber: state.prNumber } });
  const message = await postSystem(deps, updated, `❌ رفض ${input.actor.name} الـ Diff «${updated.commitMessage}»${closed}. لم يُدمج شيء.`);
  return { ok: true, proposal: updated, message };
}
