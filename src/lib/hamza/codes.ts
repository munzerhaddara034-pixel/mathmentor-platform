/**
 * In-app approval codes (Approval #1 = open the PR, Approval #2 = merge after green CI).
 * A code is single-use, expires (30 min default), is bound to {proposalId, revision, diffHash, action,
 * targetBranch}, is stored only as a salted SHA-256 and allows a limited number of attempts.
 * WhatsApp never approves code.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { CodeBinding, StoredApprovalCode } from "./types";

/** No 0/O/1/I/L: easy to read aloud and type on a phone. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_CHARS = 6;
export const CODE_PREFIX = "HMZ-";

export function canonicalBinding(binding: CodeBinding): string {
  return JSON.stringify([binding.proposalId, binding.revision, binding.diffHash, binding.action, binding.targetBranch]);
}

/** Accepts "hmz-7k3q9x", "7K3 Q9X", "HMZ-7K3Q9X" → "7K3Q9X". */
export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/^\s*HMZ[-\s]*/, "")
    .replace(/[^A-Z0-9]/g, "");
}

function digest(salt: string, code: string, binding: CodeBinding): string {
  return createHash("sha256").update(`${salt}:${normalizeCode(code)}:${canonicalBinding(binding)}`).digest("hex");
}

export function issueApprovalCode(
  binding: CodeBinding,
  options: { now: Date; ttlMinutes: number; issuedTo: string },
): { code: string; stored: StoredApprovalCode } {
  let body = "";
  for (let i = 0; i < CODE_CHARS; i += 1) body += ALPHABET[randomInt(ALPHABET.length)];
  const salt = randomBytes(16).toString("hex");
  const code = `${CODE_PREFIX}${body}`;
  return {
    code,
    stored: {
      hash: digest(salt, code, binding),
      salt,
      binding,
      issuedAt: options.now.toISOString(),
      expiresAt: new Date(options.now.getTime() + options.ttlMinutes * 60_000).toISOString(),
      issuedTo: options.issuedTo,
      attempts: 0,
    },
  };
}

export type CodeFailure = "missing" | "expired" | "used" | "locked" | "stale" | "mismatch";

export type CodeVerification =
  | { ok: true; stored: StoredApprovalCode }
  | { ok: false; reason: CodeFailure; stored?: StoredApprovalCode };

function sameBinding(a: CodeBinding, b: CodeBinding): boolean {
  return canonicalBinding(a) === canonicalBinding(b);
}

/**
 * Verifies a typed code against the CURRENT binding. Returns the updated stored record (attempts +1,
 * or usedAt on success) — the caller must persist it in the same compare-and-set as the transition.
 */
export function verifyApprovalCode(
  stored: StoredApprovalCode | undefined,
  input: { code: string; binding: CodeBinding; now: Date; maxAttempts: number },
): CodeVerification {
  if (!stored) return { ok: false, reason: "missing" };
  if (stored.usedAt) return { ok: false, reason: "used", stored };
  if (stored.attempts >= input.maxAttempts) return { ok: false, reason: "locked", stored };
  if (input.now.getTime() > Date.parse(stored.expiresAt)) return { ok: false, reason: "expired", stored };
  // A new revision / diff / branch invalidates the code even if the user typed it correctly.
  if (!sameBinding(stored.binding, input.binding)) return { ok: false, reason: "stale", stored };
  const expected = Buffer.from(stored.hash, "hex");
  const actual = Buffer.from(digest(stored.salt, input.code, input.binding), "hex");
  const attempted: StoredApprovalCode = { ...stored, attempts: stored.attempts + 1 };
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "mismatch", stored: attempted };
  }
  return { ok: true, stored: { ...attempted, usedAt: input.now.toISOString() } };
}

export const CODE_FAILURE_TEXT: Record<CodeFailure, { en: string; ar: string }> = {
  missing: { en: "No approval code was issued for this step. Request a code first.", ar: "لم يُصدَر رمز موافقة لهذه الخطوة. اطلب رمزاً أولاً." },
  expired: { en: "The approval code expired. Request a new one.", ar: "انتهت صلاحية رمز الموافقة. اطلب رمزاً جديداً." },
  used: { en: "This approval code was already used.", ar: "هذا الرمز استُعمل مسبقاً." },
  locked: { en: "Too many wrong attempts. Request a new code.", ar: "محاولات خاطئة كثيرة. اطلب رمزاً جديداً." },
  stale: { en: "The change was revised after this code was issued. Request a new code.", ar: "تغيّر الـ Diff بعد إصدار هذا الرمز. اطلب رمزاً جديداً." },
  mismatch: { en: "Wrong approval code.", ar: "رمز الموافقة غير صحيح." },
};
