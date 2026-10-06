/** Agent draft → a new TeamProposal, or a new revision of an existing one (codes cleared, back to pending). */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { createId } from "@/lib/ids";
import { chooseBranch } from "@/lib/team/developer";
import type { TeamProposal, TeamProposalStatus } from "@/lib/team/types";
import type { ProposalDraft } from "../agent/types";
import { proposalDiffHash, initialHamzaState } from "../pipeline/shared";
import { proposalTier, riskLevel } from "../limits";
import { addEvent } from "../timeline";
import type { HamzaCost } from "../types";
import type { HamzaTask } from "../tasks/types";

export const REVISABLE_STATUSES: TeamProposalStatus[] = ["pending", "failed", "ci_running", "ci_failed", "ci_passed"];

export function newProposal(input: { draft: ProposalDraft; task: HamzaTask; baseBranch: string; baseSha: string; messageId: string; cost: HamzaCost; now: Date }): TeamProposal {
  const { draft, task } = input;
  const commitMessage = draft.commitMessage || "feat: Hamza change";
  const branch = chooseBranch(task.requestText, draft.branch, commitMessage);
  const safeBranch = agentCommitBranchCheck(branch, { liveBranch: input.baseBranch }).ok ? branch : `feat/hamza-${task.id.slice(-6).toLowerCase()}`;
  const at = input.now.toISOString();
  const proposal: TeamProposal = {
    id: createId("prop"),
    channel: task.channel,
    messageId: input.messageId,
    requestText: task.requestText.slice(0, 2000),
    requestedBy: task.requestedBy,
    summaryAr: draft.summaryAr,
    risksAr: draft.risksAr,
    testPlanAr: draft.testPlanAr,
    commitMessage,
    baseBranch: input.baseBranch,
    targetBranch: safeBranch,
    files: draft.files,
    status: "pending",
    checks: [...draft.checks, ...draft.warnings],
    createdAt: at,
    updatedAt: at,
  };
  proposal.hamza = initialHamzaState(proposal, { baseCommitSha: input.baseSha, cost: input.cost, taskId: task.id });
  return proposal;
}

/** Patch for transitionProposal(): same id, same branch/PR, revision + 1, fresh hash, all codes invalidated. */
export function revisionPatch(input: { existing: TeamProposal; draft: ProposalDraft; headSha: string; cost: HamzaCost; task: HamzaTask; now: Date }): Partial<TeamProposal> & { status: TeamProposalStatus } {
  const { existing, draft } = input;
  const state = existing.hamza ?? initialHamzaState(existing);
  const tier = proposalTier(draft.files);
  const previous = state.cost;
  const cost: HamzaCost = previous
    ? { ...input.cost, usd: previous.usd + input.cost.usd, calls: previous.calls + input.cost.calls, inputTokens: previous.inputTokens + input.cost.inputTokens, outputTokens: previous.outputTokens + input.cost.outputTokens, cachedTokens: previous.cachedTokens + input.cost.cachedTokens }
    : input.cost;
  const hamza = addEvent(
    {
      ...state,
      revision: state.revision + 1,
      diffHash: proposalDiffHash(draft.files),
      tier: tier.ok ? tier.tier : "large",
      riskLevel: riskLevel(draft.files),
      baseCommitSha: input.headSha,
      codes: {},
      activeCode: undefined,
      ci: undefined,
      cost,
      taskId: input.task.id,
      repairRounds: state.repairRounds + (input.task.kind === "repair" ? 1 : 0),
      lastError: undefined,
    },
    "revised",
    input.now,
    input.task.requestedBy,
    `rev ${state.revision + 1}${input.task.kind === "repair" ? " (CI repair)" : ""}`,
  );
  return {
    status: "pending",
    files: draft.files,
    summaryAr: draft.summaryAr || existing.summaryAr,
    risksAr: draft.risksAr || existing.risksAr,
    testPlanAr: draft.testPlanAr || existing.testPlanAr,
    commitMessage: existing.commitMessage,
    checks: [...draft.checks, ...draft.warnings],
    error: undefined,
    hamza,
  };
}
