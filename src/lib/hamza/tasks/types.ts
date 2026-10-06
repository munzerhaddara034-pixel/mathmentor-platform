/** Background Hamza tasks (client-safe types). */
import type { TeamChannelId } from "@/lib/team/types";
import type { AgentCheckpoint, AgentStepRecord } from "../agent/types";
import type { RouterTurn } from "../models/providers";
import type { HamzaCost } from "../types";

export type HamzaTaskKind = "new" | "revision" | "repair";
export type HamzaTaskStatus = "queued" | "running" | "budget_paused" | "done" | "failed" | "cancelled";
export const ACTIVE_TASK_STATUSES: HamzaTaskStatus[] = ["queued", "running", "budget_paused"];
export const MAX_TASK_ATTEMPTS = 2;

export type HamzaTaskResult = { kind: "proposal" | "reply" | "paused" | "failed" | "cancelled"; proposalId?: string; messageId?: string; message?: string };

export type HamzaTask = {
  id: string;
  channel: TeamChannelId;
  kind: HamzaTaskKind;
  status: HamzaTaskStatus;
  requestText: string;
  requestedBy: string;
  requestedById: string;
  /** Human message this task answers. */
  replyToId?: string;
  /** Revision / repair target. */
  proposalId?: string;
  /** Conversation at creation (secrets already redacted). Server only. */
  turns: RouterTurn[];
  extraContext?: string;
  /** Resumable loop state (after a budget pause). Server only. */
  checkpoint?: AgentCheckpoint;
  cost: HamzaCost;
  capUsd: number;
  estimateUsd: number;
  progress: { steps: number; toolCalls: number; lastStep?: string; model?: string };
  result?: HamzaTaskResult;
  attempt: number;
  lockedBy?: string;
  lockedUntil?: string;
  cancelRequested?: boolean;
  pauseReason?: "task_budget" | "month_budget";
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

export type PublicHamzaTask = Omit<HamzaTask, "turns" | "extraContext" | "checkpoint" | "lockedBy">;

export function publicTask(task: HamzaTask): PublicHamzaTask {
  const { turns: _turns, extraContext: _extra, checkpoint: _checkpoint, lockedBy: _locked, ...rest } = task;
  void _turns;
  void _extra;
  void _checkpoint;
  void _locked;
  return rest;
}

export type HamzaTaskPatch = Partial<Omit<HamzaTask, "id" | "createdAt">>;

export interface HamzaTaskRepo {
  kind: "postgres" | "file" | "memory";
  create(task: HamzaTask): Promise<void>;
  get(id: string): Promise<HamzaTask | undefined>;
  /** Compare-and-set on status (null = any status). */
  update(id: string, from: HamzaTaskStatus[] | null, patch: HamzaTaskPatch): Promise<HamzaTask | undefined>;
  /** Oldest queued task, or a running one whose lease expired (crash recovery, ≤ MAX_TASK_ATTEMPTS). */
  claimNext(workerId: string, now: Date, leaseMs: number): Promise<HamzaTask | undefined>;
  listByChannel(channel: TeamChannelId, limit: number): Promise<HamzaTask[]>;
  listActive(): Promise<HamzaTask[]>;
  /** Newest first, all channels (activity view). */
  listRecent(limit: number): Promise<HamzaTask[]>;
  addStep(taskId: string, step: AgentStepRecord): Promise<void>;
  listSteps(taskId: string, limit: number): Promise<AgentStepRecord[]>;
  monthSpentUsd(sinceIso: string): Promise<number>;
}
