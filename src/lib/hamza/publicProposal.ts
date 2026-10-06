/** What the browser may see of a proposal: hashed approval codes are removed, only "a code is active" stays. */
import type { TeamProposal } from "@/lib/team/types";
import type { ApprovalAction, HamzaPipelineState } from "./types";

export function publicProposal(proposal: TeamProposal, now: Date = new Date(), maxAttempts = 5): TeamProposal {
  if (!proposal.hamza) return proposal;
  const activeCode: HamzaPipelineState["activeCode"] = {};
  for (const [action, code] of Object.entries(proposal.hamza.codes) as Array<[ApprovalAction, HamzaPipelineState["codes"][ApprovalAction]]>) {
    if (code && !code.usedAt && code.attempts < maxAttempts && Date.parse(code.expiresAt) > now.getTime()) {
      activeCode[action] = { expiresAt: code.expiresAt, issuedTo: code.issuedTo };
    }
  }
  return { ...proposal, hamza: { ...proposal.hamza, codes: {}, activeCode } };
}

export function publicProposals(list: TeamProposal[], now: Date = new Date()): TeamProposal[] {
  return list.map((proposal) => publicProposal(proposal, now));
}
