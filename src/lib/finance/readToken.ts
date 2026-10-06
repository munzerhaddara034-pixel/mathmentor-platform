/**
 * Read-only finance token for GET /api/finance/summary (CFO agent).
 * The token comes ONLY from MM_FINANCE_READ_TOKEN — no fallback; unset/empty fails closed (503).
 * Compared in constant time on SHA-256 digests (equal length, so the token length is not leaked).
 * The token and the Authorization header are never logged.
 * Pure module (node:crypto + rateLimit only, no Next imports) so it runs under `node --test`.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { clientIpFrom, createRateLimiter, tooManyRequestsBody, type RateLimiter } from "@/lib/security/rateLimit";

export const FINANCE_READ_TOKEN_ENV = "MM_FINANCE_READ_TOKEN";

/** Per-IP budget for the token endpoint (every request counts, before the token check). */
export const FINANCE_READ_RATE = { windowMs: 60_000, max: 30 } as const;

export const financeReadRateLimit: RateLimiter = createRateLimiter(FINANCE_READ_RATE);

const MAX_AUTH_HEADER = 4096;

export function configuredFinanceReadToken(env: Record<string, string | undefined> = process.env): string | null {
  const value = env[FINANCE_READ_TOKEN_ENV]?.trim();
  return value ? value : null;
}

/** Extracts the token from `Authorization: Bearer <token>` (scheme case-insensitive). */
export function bearerTokenFrom(headers: { get(name: string): string | null }): string | null {
  const raw = headers.get("authorization");
  if (!raw || raw.length > MAX_AUTH_HEADER) return null;
  const match = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(raw);
  return match ? match[1] : null;
}

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/** Constant-time equality via fixed-length SHA-256 digests. */
export function financeTokenMatches(given: string | null, expected: string): boolean {
  if (!given) {
    timingSafeEqual(digest(expected), digest(expected)); // keep timing similar for missing tokens
    return false;
  }
  return timingSafeEqual(digest(given), digest(expected));
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...extra } });
}

export function financeMethodNotAllowed(): Response {
  return json({ ok: false, error: "Method not allowed." }, 405, { Allow: "GET" });
}

export type FinanceSummaryDeps<T> = {
  loadSummary: () => Promise<T>;
  databaseAvailable: () => boolean;
  env?: Record<string, string | undefined>;
  limiter?: RateLimiter;
  now?: number;
  logError?: (message: string) => void;
};

/**
 * Order: method → per-IP rate limit → token configured (503) → token valid (401) → DB (503) → 200.
 * Error logs carry only a fixed prefix and the error message — never headers or the token.
 */
export async function handleFinanceSummaryRequest<T extends object>(request: Request, deps: FinanceSummaryDeps<T>): Promise<Response> {
  if (request.method !== "GET") return financeMethodNotAllowed();

  const limiter = deps.limiter ?? financeReadRateLimit;
  const limit = limiter.hit(`ip:${clientIpFrom(request.headers)}`, deps.now);
  if (!limit.ok) return json(tooManyRequestsBody(limit.retryAfterSec), 429, { "Retry-After": String(limit.retryAfterSec) });

  const expected = configuredFinanceReadToken(deps.env);
  if (!expected) return json({ ok: false, error: "Finance read token is not configured." }, 503);

  if (!financeTokenMatches(bearerTokenFrom(request.headers), expected)) {
    return json({ ok: false, error: "Unauthorized." }, 401, { "WWW-Authenticate": 'Bearer realm="finance"' });
  }

  if (!deps.databaseAvailable()) return json({ ok: false, error: "Finance data needs the database." }, 503);

  try {
    const summary = await deps.loadSummary();
    return json({ ok: true, ...summary }, 200);
  } catch (error) {
    const log = deps.logError ?? ((message: string) => console.error(message));
    log(`[mathmentor][finance] summary failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return json({ ok: false, error: "Finance summary failed." }, 500);
  }
}
