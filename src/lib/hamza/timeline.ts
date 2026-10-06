/** Proposal timeline: append events, and derive the chips shown on the card (pure; unit-tested). */
import type { TeamProposalStatus } from "@/lib/team/types";
import type { HamzaPipelineState, TimelineEvent, TimelineKind } from "./types";

export function addEvent(state: HamzaPipelineState, kind: TimelineKind, now: Date, by?: string, detail?: string): HamzaPipelineState {
  const event: TimelineEvent = { at: now.toISOString(), kind, ...(by ? { by } : {}), ...(detail ? { detail: detail.slice(0, 300) } : {}) };
  return { ...state, timeline: [...state.timeline, event].slice(-60) };
}

export type ChipKey = "proposed" | "approved" | "ci" | "merged" | "deployed";
export type ChipState = "done" | "active" | "todo" | "failed" | "reverted";
export type TimelineChip = { key: ChipKey; state: ChipState; at?: string; prNumber?: number; ci?: "running" | "passed" | "failed" };

function lastAt(state: HamzaPipelineState | undefined, kinds: TimelineKind[]): string | undefined {
  const events = state?.timeline ?? [];
  for (let i = events.length - 1; i >= 0; i -= 1) if (kinds.includes(events[i].kind)) return events[i].at;
  return undefined;
}

/** Proposed → Approved (PR #n) → CI running / passed / failed → Merged → Deployed / Reverted. */
export function timelineChips(status: TeamProposalStatus, state: HamzaPipelineState | undefined): TimelineChip[] {
  const approved = ["committing", "ci_running", "ci_failed", "ci_passed", "merging", "merged", "committed"].includes(status);
  const ciDone = ["ci_passed", "merging", "merged"].includes(status);
  const merged = status === "merged";
  const ci: TimelineChip["ci"] = status === "ci_failed" ? "failed" : ciDone ? "passed" : status === "ci_running" ? "running" : undefined;
  return [
    { key: "proposed", state: status === "rejected" ? "failed" : "done", at: lastAt(state, ["proposed", "revised"]) },
    {
      key: "approved",
      state: approved ? "done" : status === "pending" ? "active" : status === "failed" ? "failed" : "todo",
      at: lastAt(state, ["approved_pr"]),
      prNumber: state?.prNumber,
    },
    {
      key: "ci",
      state: ci === "failed" ? "failed" : ci === "passed" ? "done" : ci === "running" ? "active" : "todo",
      at: lastAt(state, ["ci_passed", "ci_failed", "ci_running"]),
      ci,
    },
    { key: "merged", state: merged ? "done" : status === "ci_passed" || status === "merging" ? "active" : "todo", at: state?.mergedAt },
    { key: "deployed", state: state?.reverted ? "reverted" : merged ? "done" : "todo", at: lastAt(state, state?.reverted ? ["reverted"] : ["merged"]) },
  ];
}
