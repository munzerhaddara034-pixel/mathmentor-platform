/**
 * In-process background worker (started from instrumentation-node.ts unless HAMZA_WORKER=0):
 * every tick it claims at most one Hamza task and polls CI for PRs waiting on `hamza-ci`.
 * Multi-instance safe with Postgres (SKIP LOCKED claims + leases); the JSON store is single-instance.
 */
import { createId } from "@/lib/ids";
import type { TeamRepo } from "@/lib/team/repo";
import type { HamzaConfig } from "./config";
import { needsCiPoll } from "./pipeline/ciRefresh";
import type { PipelineResult } from "./pipeline/shared";
import { HAMZA_TASK_LEASE_MS, runHamzaTask } from "./runner/runTask";
import type { RunnerDeps } from "./runner/types";
import type { HamzaTaskRepo } from "./tasks/types";

export type WorkerDeps = {
  config: HamzaConfig;
  tasks: HamzaTaskRepo;
  teamRepo: TeamRepo;
  now: () => Date;
  runner: () => RunnerDeps;
  refreshCi: (proposalId: string) => Promise<PipelineResult>;
};

export type TickResult = { ran?: string; polled: number; errors: string[] };

const CI_POLL_MIN_MS = 45_000;
const workerId = createId("hworker");

export async function hamzaWorkerTick(deps: WorkerDeps): Promise<TickResult> {
  const result: TickResult = { polled: 0, errors: [] };
  if (!deps.config.enabled || !deps.config.workerEnabled) return result;
  try {
    const task = await deps.tasks.claimNext(workerId, deps.now(), HAMZA_TASK_LEASE_MS);
    if (task) {
      result.ran = task.id;
      await runHamzaTask(deps.runner(), task);
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "task error");
  }
  try {
    const waiting = (await deps.teamRepo.listProposalsByStatus(["ci_running"], 20)).filter(needsCiPoll);
    const nowMs = deps.now().getTime();
    for (const proposal of waiting) {
      const checked = Date.parse(proposal.hamza?.ci?.checkedAt ?? "");
      if (Number.isFinite(checked) && nowMs - checked < CI_POLL_MIN_MS) continue;
      await deps.refreshCi(proposal.id);
      result.polled += 1;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "ci poll error");
  }
  return result;
}

type Holder = { mmHamzaWorker?: { timer: ReturnType<typeof setInterval>; busy: boolean } };

/** Starts the interval once per process. `deps` is resolved lazily on every tick (env changes, test overrides). */
export function startHamzaWorker(deps: () => WorkerDeps, intervalMs = 15_000): boolean {
  const holder = globalThis as unknown as Holder;
  if (holder.mmHamzaWorker) return false;
  const state: { busy: boolean; timer: ReturnType<typeof setInterval> } = {
    busy: false,
    timer: setInterval(async () => {
      if (state.busy) return;
      state.busy = true;
      try {
        const tick = await hamzaWorkerTick(deps());
        if (tick.errors.length) console.error("[hamza] worker:", tick.errors.join(" | "));
      } catch (error) {
        console.error("[hamza] worker tick failed:", error instanceof Error ? error.message : error);
      } finally {
        state.busy = false;
      }
    }, intervalMs),
  };
  state.timer.unref?.();
  holder.mmHamzaWorker = state;
  return true;
}
