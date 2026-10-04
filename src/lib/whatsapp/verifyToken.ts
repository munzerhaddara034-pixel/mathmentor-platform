/**
 * Meta webhook verification (GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…).
 * The verify token comes ONLY from WHATSAPP_VERIFY_TOKEN — there is no hardcoded fallback any more
 * (the old built-in values were public in the repo). If the env var is unset, verification fails
 * closed and logs a clear line so the owner knows why Meta's "Verify and save" failed.
 * Dependency-free apart from node:crypto (unit-tested in tests/whatsappVerifyToken.test.mjs).
 */
import { timingSafeEqual } from "node:crypto";

export type VerifyFailure = "not_configured" | "bad_request" | "mismatch";

export type VerifyDecision = { ok: true; challenge: string } | { ok: false; reason: VerifyFailure };

export function configuredVerifyToken(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.WHATSAPP_VERIFY_TOKEN?.trim();
  return value ? value : null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Reads both `hub.x` and `hub_x` spellings (some proxies rewrite dots). */
export function decideMetaVerification(
  params: URLSearchParams,
  env: Record<string, string | undefined> = process.env,
): VerifyDecision {
  const mode = params.get("hub.mode") || params.get("hub_mode");
  const token = params.get("hub.verify_token") || params.get("hub_verify_token");
  const challenge = params.get("hub.challenge") || params.get("hub_challenge");
  const expected = configuredVerifyToken(env);
  if (!expected) return { ok: false, reason: "not_configured" };
  if (mode !== "subscribe" || !token || !challenge) return { ok: false, reason: "bad_request" };
  if (!constantTimeEqual(token, expected)) return { ok: false, reason: "mismatch" };
  return { ok: true, challenge };
}

/** True when the request looks like a Meta verification attempt (so a plain GET can be answered differently). */
export function isVerificationAttempt(params: URLSearchParams): boolean {
  return Boolean(params.get("hub.mode") || params.get("hub_mode") || params.get("hub.verify_token") || params.get("hub_verify_token"));
}

export function logVerificationFailure(route: string, reason: VerifyFailure) {
  if (reason === "not_configured") {
    console.error(
      `[whatsapp] ${route}: webhook verification REFUSED — WHATSAPP_VERIFY_TOKEN is not set. ` +
        "Set it on the server to the exact value typed in Meta → WhatsApp → Configuration → Verify token.",
    );
  } else if (reason === "mismatch") {
    console.warn(`[whatsapp] ${route}: webhook verification refused — hub.verify_token does not match WHATSAPP_VERIFY_TOKEN.`);
  }
}
