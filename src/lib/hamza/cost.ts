/** Cost ledger per task + budget checks + Beirut-month key (pure; unit-tested). */
import type { HamzaCost, ProposalTier } from "./types";

export function emptyCost(estimateUsd?: number): HamzaCost {
  return { usd: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, calls: 0, models: [], ...(estimateUsd !== undefined ? { estimateUsd } : {}) };
}

export function addUsage(
  cost: HamzaCost,
  call: { model: string; usd: number; usage: { inputTokens: number; cachedTokens: number; outputTokens: number } },
): HamzaCost {
  return {
    ...cost,
    usd: Math.round((cost.usd + call.usd) * 1_000_000) / 1_000_000,
    inputTokens: cost.inputTokens + call.usage.inputTokens,
    cachedTokens: cost.cachedTokens + call.usage.cachedTokens,
    outputTokens: cost.outputTokens + call.usage.outputTokens,
    calls: cost.calls + 1,
    models: cost.models.includes(call.model) ? cost.models : [...cost.models, call.model].slice(-6),
  };
}

/** Plan §5.1 estimates by size, shown before the run. */
export const ESTIMATE_USD: Record<"small" | "medium" | "large", number> = { small: 0.25, medium: 1, large: 3 };

export function estimateFor(text: string, tier?: ProposalTier): number {
  if (tier === "large") return ESTIMATE_USD.large;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words > 80 ? ESTIMATE_USD.large : words > 25 ? ESTIMATE_USD.medium : ESTIMATE_USD.small;
}

export type BudgetState = { ok: true; remainingUsd: number } | { ok: false; reason: "task" | "month"; spentUsd: number; capUsd: number };

export function checkBudget(input: { taskUsd: number; taskCapUsd: number; monthUsd: number; monthCapUsd: number }): BudgetState {
  if (input.monthUsd >= input.monthCapUsd) return { ok: false, reason: "month", spentUsd: input.monthUsd, capUsd: input.monthCapUsd };
  if (input.taskUsd >= input.taskCapUsd) return { ok: false, reason: "task", spentUsd: input.taskUsd, capUsd: input.taskCapUsd };
  return { ok: true, remainingUsd: Math.min(input.taskCapUsd - input.taskUsd, input.monthCapUsd - input.monthUsd) };
}

/** "2026-10" in Asia/Beirut, and the UTC instant that month started (for SUM queries). */
export function beirutMonth(now: Date): { key: string; startIso: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  // Beirut is UTC+2 or UTC+3; start from UTC midnight minus 3h and correct to the first Beirut instant.
  let start = Date.UTC(year, month - 1, 1) - 3 * 3_600_000;
  const label = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit" }).format(new Date(t));
  const key = `${year}-${String(month).padStart(2, "0")}`;
  while (label(start) !== key) start += 3_600_000;
  return { key, startIso: new Date(start).toISOString() };
}
