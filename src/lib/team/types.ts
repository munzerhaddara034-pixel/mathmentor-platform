/**
 * Shared (client + server) types for the /admin/team chat.
 * Channel ids follow docs/TEAM_CHAT_SPEC.md §0.1.
 */
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import type { HamzaPipelineState } from "@/lib/hamza/types";

export const TEAM_CHANNEL_IDS = ["team", "mohamed", "sami", "developer"] as const;
export type TeamChannelId = (typeof TEAM_CHANNEL_IDS)[number];

export const TEAM_AGENT_IDS = ["mohamed", "sami", "developer"] as const;
export type TeamAgentId = (typeof TEAM_AGENT_IDS)[number];

export type TeamAuthorKind = "human" | "agent" | "system";

export function isTeamChannelId(value: unknown): value is TeamChannelId {
  return typeof value === "string" && (TEAM_CHANNEL_IDS as readonly string[]).includes(value);
}

export function isTeamAgentId(value: unknown): value is TeamAgentId {
  return typeof value === "string" && (TEAM_AGENT_IDS as readonly string[]).includes(value);
}

export type TeamAttachmentRef = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** "upload" = sent by a human, "generated" = produced by an agent (e.g. سامي image). */
  origin: "upload" | "generated";
};

export type TeamMessage = {
  id: string;
  channel: TeamChannelId;
  authorKind: TeamAuthorKind;
  /** Agent id for agents, staff user id for humans, "system" for notices. */
  authorId: string;
  authorName: string;
  text: string;
  attachments: TeamAttachmentRef[];
  createdAt: string;
  /** Human message this agent reply answers (loop guard + audit trail). */
  replyToId?: string;
  /** Set when an agent answers a referral (@mention + task) from another agent. */
  referredById?: string;
  /** Developer proposal attached to this message. */
  proposalId?: string;
  /** Hamza background task this message belongs to (TaskCard renders under it). */
  taskId?: string;
  /** Image prompt drafted by سامي (always shown, image or not). */
  imagePrompt?: string;
  /** Redaction notice when a secret was removed from a human message. */
  redactedSecrets?: number;
  /** Non-fatal notice (e.g. missing GEMINI_API_KEY) rendered under the bubble. */
  notice?: string;
};

/**
 * pending → committing (opening the PR) → ci_running → ci_passed | ci_failed → merging → merged.
 * "committed" is the pre-PR flow (feature-branch commit only) kept for old rows.
 */
export type TeamProposalStatus =
  | "pending"
  | "committing"
  | "committed"
  | "ci_running"
  | "ci_failed"
  | "ci_passed"
  | "merging"
  | "merged"
  | "rejected"
  | "failed";

export const TEAM_PROPOSAL_STATUSES: TeamProposalStatus[] = [
  "pending",
  "committing",
  "committed",
  "ci_running",
  "ci_failed",
  "ci_passed",
  "merging",
  "merged",
  "rejected",
  "failed",
];

export type TeamFileChange = "add" | "modify" | "delete" | "rename";

export type TeamProposalFile = {
  path: string;
  /** Blob sha on the base when the diff was proposed (null = new file). For a rename: the old path's sha. */
  baseSha: string | null;
  isNew: boolean;
  /** Full new content ("" for a delete). */
  newContent: string;
  diff: string;
  additions: number;
  deletions: number;
  /** Multi-file patches (Hamza v2). Absent on old rows = add (isNew) or modify. */
  change?: TeamFileChange;
  /** Rename source. */
  oldPath?: string;
  /** Content before the change (split view, revert). Absent for new files. */
  oldContent?: string;
};

export type TeamProposal = {
  id: string;
  channel: TeamChannelId;
  messageId: string;
  requestText: string;
  requestedBy: string;
  summaryAr: string;
  risksAr: string;
  testPlanAr: string;
  commitMessage: string;
  baseBranch: string;
  /** Suggested feature branch (feat/… or fix/…). */
  targetBranch: string;
  files: TeamProposalFile[];
  status: TeamProposalStatus;
  checks: string[];
  createdAt: string;
  updatedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  committedBranch?: string;
  commitSha?: string;
  commitUrl?: string;
  error?: string;
  /** Hamza v2 pipeline (PR, CI, codes, timeline, cost). Codes are stripped before reaching the browser. */
  hamza?: HamzaPipelineState;
};

export type TeamChannelMeta = {
  id: TeamChannelId;
  labelAr: string;
  subtitleAr: string;
  avatar: string;
};

export const TEAM_CHANNELS: TeamChannelMeta[] = [
  { id: "team", labelAr: "الفريق كله", subtitleAr: "محمد · سامي · حمزة", avatar: "👥" },
  { id: "mohamed", labelAr: "محمد", subtitleAr: "مدير المنصة · السكرتير · دكتور الرياضيات", avatar: "م" },
  { id: "sami", labelAr: "سامي", subtitleAr: "تصميم الويب · الصور · الميديا", avatar: "س" },
  { id: "developer", labelAr: "حمزة", subtitleAr: "المبرمج · وكيل المطوّر · Diff ثم موافقة", avatar: "</>" },
];

export const TEAM_AGENT_NAMES_AR: Record<TeamAgentId, string> = {
  mohamed: "محمد",
  sami: "سامي",
  developer: "حمزة",
};

/**
 * Display name for a message author. Agent messages use the CURRENT agent name
 * (e.g. «حمزة» for "developer") so rows stored under an older name still read right.
 */
export function teamAuthorDisplayName(
  message: Pick<TeamMessage, "authorKind" | "authorId" | "authorName">,
  names: Record<TeamAgentId, string> = TEAM_AGENT_NAMES_AR,
): string {
  if (message.authorKind === "agent" && isTeamAgentId(message.authorId)) return names[message.authorId];
  return message.authorName;
}

export type TeamThreadResponse = {
  ok: true;
  channel: TeamChannelId;
  messages: TeamMessage[];
  proposals: TeamProposal[];
  /** Hamza background tasks of this channel (newest last; server-only fields stripped). */
  tasks: PublicHamzaTask[];
  storage: "postgres" | "file";
};

export type TeamSendResponse = {
  ok: true;
  message: TeamMessage;
  replies: TeamMessage[];
  proposals: TeamProposal[];
};

export type TeamApiError = { ok: false; error: string; errorAr: string };
