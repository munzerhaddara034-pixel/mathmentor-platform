/** Meta (WhatsApp Cloud API) webhook signature: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(appSecret, rawBody). */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string): boolean {
  if (!appSecret || !header) return false;
  const given = header.trim();
  if (!given.toLowerCase().startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(given.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time string comparison for shared secrets. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
