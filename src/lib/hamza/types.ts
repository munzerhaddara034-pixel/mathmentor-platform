/**
 * Client-safe types for Hamza's pipeline state (stored inside TeamProposal.hamza).
 * No Node imports here: these types are used by /admin/team components too.
 */

export type ApprovalAction = "open_pr" | "merge";

/** What an approval code is bound to. Any change (new revision, other diff, other branch) makes it stale. */
export type CodeBinding = {
  proposalId: string;
  revision: number;
  diffHash: string;
  action: ApprovalAction;
  targetBranch: string;
};

/** Stored hashed — never sent to the browser (see publicProposal()). */
export type StoredApprovalCode = {
  hash: string;
  salt: string;
  binding: CodeBinding;
  issuedAt: string;
  expiresAt: string;
  issuedTo: string;
  attempts: number;
  usedAt?: string;
};

export type CiState = "pending" | "running" | "passed" | "failed" | "missing";

export type CiCheckResult = {
  name: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  url?: string;
  durationSec?: number;
};

export type CiSummary = {
  state: CiState;
  headSha: string;
  checks: CiCheckResult[];
  checkedAt: string;
  /** First error lines from the failing job log (≤30 lines). */
  errorExcerpt?: string;
  /** Set once the terminal result was posted in the chat (idempotent reporting). */
  reportedAt?: string;
};

export type TimelineKind =
  | "proposed"
  | "revised"
  | "code_issued"
  | "approved_pr"
  | "pr_opened"
  | "ci_running"
  | "ci_passed"
  | "ci_failed"
  | "repair_requested"
  | "approved_merge"
  | "merged"
  | "revert_requested"
  | "reverted"
  | "rejected"
  | "failed";

export type TimelineEvent = { at: string; kind: TimelineKind; by?: string; detail?: string };

export type ProposalTier = "standard" | "large";
export type RiskLevel = "low" | "medium" | "high";

export type HamzaCost = {
  usd: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  calls: number;
  models: string[];
  /** Estimate shown before the run, by tier. */
  estimateUsd?: number;
};

export type HamzaPipelineState = {
  revision: number;
  diffHash: string;
  tier: ProposalTier;
  riskLevel: RiskLevel;
  /** Commit the patch was computed against (live branch head at proposal time). */
  baseCommitSha?: string;
  prNumber?: number;
  prUrl?: string;
  headSha?: string;
  ci?: CiSummary;
  mergeSha?: string;
  mergedAt?: string;
  mergedBy?: string;
  /** This proposal reverts another (merged) proposal. */
  revertOf?: string;
  /** Set on a merged proposal once its revert proposal exists / merged. */
  revertProposalId?: string;
  reverted?: boolean;
  repairRounds: number;
  codes: Partial<Record<ApprovalAction, StoredApprovalCode>>;
  timeline: TimelineEvent[];
  cost?: HamzaCost;
  taskId?: string;
  /** Browser view only (publicProposal): which codes are live, never the hashes. */
  activeCode?: Partial<Record<ApprovalAction, { expiresAt: string; issuedTo: string }>>;
  /** Last pipeline error shown on the card. */
  lastError?: string;
};
