/**
 * One wall-clock budget for a whole solve request.
 *
 * The pipeline can make several provider calls (solve → repair → verify). Their individual budgets added
 * up to far more than a hosting platform's request timeout, so a slow question produced a dead request
 * instead of an answer. Everything now clamps to a single deadline that fits the platform, and the
 * synchronous verification pass is skipped (and scheduled in the background) when little time is left.
 */
const MIN_TOTAL_MS = 15_000;
const MAX_TOTAL_MS = 300_000;

function envMs(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.max(Math.round(raw), MIN_TOTAL_MS), MAX_TOTAL_MS);
}

/** Total wall-clock budget for one solve request; keeps every answer inside the platform timeout. */
export const SOLVER_TOTAL_BUDGET_MS = envMs("SOLVER_TOTAL_BUDGET_MS", 55_000);
/** Below this, the synchronous verification pass is deferred to the background. */
export const SOLVER_VERIFY_MIN_MS = envMs("SOLVER_VERIFY_MIN_MS", 18_000);
/**
 * Time held back from the primary provider so a slow Gemini answer still leaves room for one fast rescue
 * call (DeepSeek / OpenAI). Without it the primary provider spends the whole budget and the student gets
 * the offline demo answer even though a fast provider was available.
 */
export const SOLVER_RESCUE_RESERVE_MS = envMs("SOLVER_RESCUE_RESERVE_MS", 15_000);
/** A provider call needs at least this much time left to be worth starting. */
export const SOLVER_MIN_CALL_MS = 6_000;

export type SolverBudget = { deadlineMs: number; callTimeoutMs: number };

export type SolverDeadline = {
  readonly totalMs: number;
  readonly startedAt: number;
  remaining(now?: number): number;
  expired(now?: number): boolean;
};

export function createDeadline(totalMs: number = SOLVER_TOTAL_BUDGET_MS, now: number = Date.now()): SolverDeadline {
  return {
    totalMs,
    startedAt: now,
    remaining(current: number = Date.now()) {
      return Math.max(0, totalMs - (current - now));
    },
    expired(current: number = Date.now()) {
      return this.remaining(current) <= 0;
    },
  };
}

/**
 * Clamps a per-call budget to what is left of the request: the call never gets more than the remaining
 * time, never less than {@link SOLVER_MIN_CALL_MS} (so a hopeless call fails fast instead of hanging), and
 * the per-call timeout never exceeds its own deadline.
 */
export function clampSolverBudget<T extends SolverBudget>(budget: T, remainingMs: number = SOLVER_TOTAL_BUDGET_MS): T {
  const room = Math.max(SOLVER_MIN_CALL_MS, Math.min(Math.round(remainingMs) || 0, SOLVER_TOTAL_BUDGET_MS * 6));
  const deadlineMs = Math.max(SOLVER_MIN_CALL_MS, Math.min(budget.deadlineMs, room));
  const callTimeoutMs = Math.max(1_000, Math.min(budget.callTimeoutMs, deadlineMs));
  return { ...budget, deadlineMs, callTimeoutMs };
}

/** True when there is still enough time for the extra verification pass before answering. */
/** True when a further provider call can still finish inside the deadline. */
/** Budget handed to the primary provider once the rescue window is held back. */
export function primaryBudgetMs(remainingMs: number, reserveMs: number = 0): number {
  return Math.max(SOLVER_MIN_CALL_MS, Math.round(remainingMs) - Math.max(0, Math.round(reserveMs)));
}

export function canStartCall(remainingMs: number, minimumMs: number = SOLVER_MIN_CALL_MS): boolean {
  return remainingMs >= minimumMs;
}

/** True when there is still enough time for the extra verification pass before answering. */
export function shouldVerifySynchronously(remainingMs: number, minimumMs: number = SOLVER_VERIFY_MIN_MS): boolean {
  return remainingMs >= minimumMs;
}
