/**
 * Signed, expiring guest join links for a single booking (HMAC-SHA256).
 * Secret: LIVE_JOIN_SECRET, else AGENT_WEBHOOK_SECRET (both server-only, ≥16 chars).
 * Format: `<base64url(JSON {b,s,e})>.<base64url(hmac)>` — b=bookingId, s=studentId, e=expiry ms.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const LIVE_GUEST_COOKIE = "mm_live_guest";
const MIN_SECRET_LENGTH = 16;
/** Link stays valid until the session end plus this grace. */
export const JOIN_GRACE_MINUTES = 120;

export type JoinClaims = { bookingId: string; studentId: string; expiresAt: number };

export type JoinVerify =
  | ({ ok: true } & JoinClaims)
  | { ok: false; reason: "no_secret" | "malformed" | "bad_signature" | "expired" };

export function liveJoinSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = (env.LIVE_JOIN_SECRET || env.AGENT_WEBHOOK_SECRET || "").trim();
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`mm-live-join:${payload}`).digest("base64url");
}

export function joinExpiryFor(booking: { startsAt: string; durationMinutes: number }, graceMinutes = JOIN_GRACE_MINUTES) {
  const start = Date.parse(booking.startsAt);
  const base = Number.isFinite(start) ? start : Date.now();
  return base + (booking.durationMinutes + graceMinutes) * 60_000;
}

export function signJoinToken(claims: JoinClaims, secret: string): string {
  const payload = b64url(JSON.stringify({ b: claims.bookingId, s: claims.studentId, e: claims.expiresAt }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyJoinToken(token: string, secret: string | null, now = Date.now()): JoinVerify {
  if (!secret) return { ok: false, reason: "no_secret" };
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || token.length > 1024) return { ok: false, reason: "malformed" };
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "bad_signature" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "malformed" };
  const record = parsed as Record<string, unknown>;
  const { b, s, e } = record;
  if (typeof b !== "string" || typeof s !== "string" || typeof e !== "number") return { ok: false, reason: "malformed" };
  if (e <= now) return { ok: false, reason: "expired" };
  return { ok: true, bookingId: b, studentId: s, expiresAt: e };
}
