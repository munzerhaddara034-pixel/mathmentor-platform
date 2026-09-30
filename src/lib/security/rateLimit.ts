/**
 * In-memory fixed-window rate limiter (per server instance) to slow credential brute force.
 * Pure module (no Next imports) so it runs under `node --test`.
 *
 * Limits are per process: several Render instances each keep their own counters, which is
 * fine for slowing brute force. Restarting the server resets the counters.
 */

export type RateLimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSec: number };

export type RateLimiter = {
  /** Count one hit for `key`; returns ok=false once the window's budget is spent. */
  hit(key: string, now?: number): RateLimitResult;
  /** Peek without counting. */
  check(key: string, now?: number): RateLimitResult;
  /** Forget a key (e.g. reset the failure counter after a successful login). */
  reset(key: string): void;
  size(): number;
};

type Bucket = { count: number; resetAt: number };

export function createRateLimiter(options: { windowMs: number; max: number; maxKeys?: number }): RateLimiter {
  const { windowMs, max } = options;
  const maxKeys = options.maxKeys ?? 50_000;
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    if (buckets.size < maxKeys) return;
    for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
    // Still full (flood of distinct keys): drop the oldest entries (Map keeps insertion order).
    while (buckets.size >= maxKeys) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined) break;
      buckets.delete(oldest);
    }
  }

  function current(key: string, now: number): Bucket | undefined {
    const bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= now) {
      buckets.delete(key);
      return undefined;
    }
    return bucket;
  }

  return {
    hit(key, now = Date.now()) {
      let bucket = current(key, now);
      if (!bucket) {
        sweep(now);
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= max) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
      }
      bucket.count += 1;
      return { ok: true, remaining: max - bucket.count };
    },
    check(key, now = Date.now()) {
      const bucket = current(key, now);
      if (!bucket) return { ok: true, remaining: max };
      if (bucket.count >= max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
      return { ok: true, remaining: max - bucket.count };
    },
    reset(key) {
      buckets.delete(key);
    },
    size() {
      return buckets.size;
    },
  };
}

/**
 * Best-effort client IP. Render/most proxies put the client first in X-Forwarded-For.
 * A client can spoof extra entries, so IP limits are paired with per-email limits.
 */
export function clientIpFrom(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

const MINUTE = 60_000;

/** Shared auth limiters (module singletons, one set per server process). */
export const authRateLimits = {
  /** Every login attempt per IP. */
  loginIp: createRateLimiter({ windowMs: 15 * MINUTE, max: 30 }),
  /** Failed logins per account email (reset on success). */
  loginEmailFailures: createRateLimiter({ windowMs: 15 * MINUTE, max: 10 }),
  /** Signups per IP. */
  signupIp: createRateLimiter({ windowMs: 60 * MINUTE, max: 10 }),
  /** Verification e-mails per IP and per address. */
  verifyEmailIp: createRateLimiter({ windowMs: 60 * MINUTE, max: 10 }),
  verifyEmailAddress: createRateLimiter({ windowMs: 60 * MINUTE, max: 3 }),
  /** Verification-link redemption attempts per IP (token guessing). */
  verifyTokenIp: createRateLimiter({ windowMs: 15 * MINUTE, max: 30 }),
};

export function tooManyRequestsBody(retryAfterSec: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return {
    ok: false as const,
    error: `Too many attempts. Try again in about ${minutes} minute(s).`,
    errorAr: `محاولات كثيرة. حاول مجدداً بعد نحو ${minutes} دقيقة.`,
    retryAfterSec,
  };
}
