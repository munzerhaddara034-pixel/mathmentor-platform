/** Agent loop inputs/outputs (no Node imports). */
import type { TeamProposalFile } from "@/lib/team/types";
import type { RouterResult } from "../models/router";
import type { RouterRequest, RouterTurn } from "../models/providers";
import type { RepoSnapshot } from "../snapshot";
import type { HamzaCost } from "../types";
import type { SyntaxFn } from "./prechecks";

export type AgentStepKind = "tool" | "propose" | "precheck_failed" | "reply" | "invalid" | "error";
export type AgentStepRecord = { n: number; kind: AgentStepKind; at: string; model?: string; usd: number; tool?: string; summary: string };

export type AgentCheckpoint = { turns: RouterTurn[]; cost: HamzaCost; steps: number; toolCalls: number; patchRounds: number };

export type AgentDeps = {
  call: (request: RouterRequest) => Promise<RouterResult>;
  tools: { run: (name: string, args: Record<string, unknown>) => Promise<string> };
  snapshot: RepoSnapshot;
  nowMs: () => number;
  monthSpentUsd: () => Promise<number>;
  isCancelled?: () => Promise<boolean>;
  onStep?: (record: AgentStepRecord, checkpoint: AgentCheckpoint) => Promise<void>;
  syntax?: SyntaxFn;
};

export type AgentLimits = { maxSteps: number; maxToolCalls: number; timeoutMs: number; maxPatchRounds: number; taskCapUsd: number; monthCapUsd: number };

export type AgentInput = {
  system: string;
  turns: RouterTurn[];
  resume?: AgentCheckpoint;
  estimateUsd?: number;
  /** Team turns must inspect memory/repository/action state before a final answer. */
  requireToolCall?: boolean;
};

export type ProposalDraft = {
  files: TeamProposalFile[];
  summaryAr: string;
  risksAr: string;
  testPlanAr: string;
  commitMessage: string;
  branch: string;
  replyAr: string;
  checks: string[];
  warnings: string[];
};

type Common = { cost: HamzaCost; steps: number; toolCalls: number };
export type AgentOutcome =
  | (Common & { kind: "proposal"; draft: ProposalDraft })
  | (Common & { kind: "reply"; text: string })
  | (Common & { kind: "paused"; reason: "task_budget" | "month_budget"; checkpoint: AgentCheckpoint; message: string })
  | (Common & { kind: "failed"; reason: "timeout" | "steps" | "models" | "cancelled" | "prechecks"; message: string });
