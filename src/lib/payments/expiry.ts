/** Subscription period maths (pure, unit-tested). Owner decision: monthly = 30 days, term = 90 days,
 * extended from the current expiry when it is still in the future. */
import type { PaymentPeriod } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 7;

export function periodDaysFor(period: PaymentPeriod): number {
  return period === "term" ? 90 : 30;
}

export function computePeriod(
  currentExpiry: string | Date | null | undefined,
  period: PaymentPeriod,
  now: Date = new Date(),
  override?: Date | null,
): { start: Date; end: Date } {
  const current = currentExpiry ? new Date(currentExpiry).getTime() : NaN;
  const startMs = Number.isFinite(current) && current > now.getTime() ? current : now.getTime();
  const start = new Date(startMs);
  if (override) return { start: override.getTime() > startMs ? start : now, end: override };
  return { start, end: new Date(startMs + periodDaysFor(period) * DAY_MS) };
}

export type FinanceStatus = "never_paid" | "overdue" | "expiring_soon" | "active";

export function financeStatus(expiresAt: string | Date | null | undefined, now: Date = new Date()): FinanceStatus {
  if (!expiresAt) return "never_paid";
  const at = new Date(expiresAt).getTime();
  if (!Number.isFinite(at)) return "never_paid";
  if (at < now.getTime()) return "overdue";
  if (at < now.getTime() + EXPIRING_SOON_DAYS * DAY_MS) return "expiring_soon";
  return "active";
}
