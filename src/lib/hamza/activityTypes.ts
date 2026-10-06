/** Client-safe types for the Hamza activity & cost view. */
import type { PublicHamzaTask } from "./tasks/types";

export type HamzaActivityEvent = { at: string; action: string; target: string | null; actorEmail: string | null; details: Record<string, unknown> };

export type HamzaActivity = {
  monthKey: string;
  monthUsd: number;
  monthCapUsd: number;
  taskCapUsd: number;
  taskMaxUsd: number;
  counts: { tasks: number; proposals: number; prs: number; merged: number; ciFailed: number; reverts: number };
  byModel: Array<{ model: string; usd: number }>;
  tasks: PublicHamzaTask[];
  events: HamzaActivityEvent[];
};
