/** Storage contract for the team chat (Postgres tables or the JSON file fallback). */
import type { TeamAttachmentRef, TeamChannelId, TeamMessage, TeamProposal, TeamProposalStatus } from "./types";

export type StoredAttachment = { meta: TeamAttachmentRef; bytes: Buffer };

export interface TeamRepo {
  kind: "postgres" | "file";
  listMessages(channel: TeamChannelId, limit: number): Promise<TeamMessage[]>;
  getMessage(id: string): Promise<TeamMessage | undefined>;
  addMessage(message: TeamMessage): Promise<void>;
  saveAttachment(meta: TeamAttachmentRef, bytes: Buffer): Promise<void>;
  getAttachment(id: string): Promise<StoredAttachment | undefined>;
  saveProposal(proposal: TeamProposal): Promise<void>;
  getProposal(id: string): Promise<TeamProposal | undefined>;
  listProposals(ids: string[]): Promise<TeamProposal[]>;
  /** Atomic compare-and-set on status; returns the updated proposal or undefined if the status did not match. */
  transitionProposal(
    id: string,
    from: TeamProposalStatus[],
    patch: Partial<TeamProposal> & { status: TeamProposalStatus },
  ): Promise<TeamProposal | undefined>;
}
