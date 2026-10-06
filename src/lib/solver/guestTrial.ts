/**
 * Guest solver trial — a visitor may solve a few problems per day without an account.
 *
 * Why a stored document and not just an in-memory limiter: the budget must survive a redeploy and be
 * shared by every instance, otherwise the same visitor gets a fresh allowance after each deploy. The
 * counter is keyed by a hash of the client IP (no raw address is stored) and resets when the UTC day
 * changes, so yesterday's keys are dropped automatically.
 */
import { createHash } from "node:crypto";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";

/** Free solves per visitor per day. Keep small: this is the cost of the funnel, not the product. */
export const GUEST_DAILY_LIMIT = 3;
/** Guest questions are capped so one trial cannot buy an expensive, essay-length solve. */
export const GUEST_MAX_QUESTION_CHARS = 400;
const STORE_FILE = "guest-solves.json";

type GuestDay = { day: string; counts: Record<string, number> };

/** Opaque per-day key: the raw IP never reaches the store. */
export function guestKey(ip: string) {
  return createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 24);
}

export function guestDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export type GuestQuota = { limit: number; used: number; remaining: number };

export async function readGuestQuota(ip: string, now = Date.now()): Promise<GuestQuota> {
  const day = guestDay(now);
  const stored = await readJsonFile<Partial<GuestDay>>(STORE_FILE, { day, counts: {} });
  const used = stored.day === day ? (stored.counts?.[guestKey(ip)] ?? 0) : 0;
  return { limit: GUEST_DAILY_LIMIT, used, remaining: Math.max(0, GUEST_DAILY_LIMIT - used) };
}

/** Count one successful guest solve. Called only after the solver answered, never before. */
export async function recordGuestSolve(ip: string, now = Date.now()): Promise<GuestQuota> {
  const day = guestDay(now);
  const key = guestKey(ip);
  const counts = await updateJsonFile<GuestDay>(STORE_FILE, { day, counts: {} }, (current) => {
    const fresh = current.day === day ? { ...current.counts } : {};
    fresh[key] = (fresh[key] ?? 0) + 1;
    return { day, counts: fresh };
  });
  const used = counts.counts[key] ?? 0;
  return { limit: GUEST_DAILY_LIMIT, used, remaining: Math.max(0, GUEST_DAILY_LIMIT - used) };
}
