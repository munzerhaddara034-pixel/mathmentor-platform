/**
 * Scratch-card / top-up code generation (server only). Codes are bearer credentials, so the random
 * part comes from the node:crypto CSPRNG (randomInt). Pure apart from the CSPRNG (unit-tested).
 */
import { randomInt } from "node:crypto";

/** No 0/O/1/I/L: codes are typed by hand from printed cards. 31 symbols ≈ 4.95 bits each. */
export const CARD_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CARD_CODE_RANDOM_LENGTH = 8;
const MAX_PREFIX = 24;

export function normalizeCardCode(code: string): string {
  return code.trim().toUpperCase();
}

export function cleanCardPrefix(prefix: string | undefined, fallback: string): string {
  const cleaned = normalizeCardCode(prefix || "").replace(/[^A-Z0-9-]/g, "").replace(/-+$/g, "").slice(0, MAX_PREFIX);
  return cleaned || fallback;
}

export function randomCardSuffix(length = CARD_CODE_RANDOM_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += CARD_CODE_ALPHABET[randomInt(CARD_CODE_ALPHABET.length)];
  return out;
}

/**
 * `count` new codes `PREFIX-XXXXXXXX`, unique among themselves and against `existing`
 * (case-insensitive). A collision (≈ 31^-8 per pair) just draws again.
 */
export function generateCardCodes(prefix: string, count: number, existing: Iterable<string>): string[] {
  const taken = new Set(Array.from(existing, (code) => code.toUpperCase()));
  const codes: string[] = [];
  while (codes.length < count) {
    const code = `${prefix}-${randomCardSuffix()}`;
    if (taken.has(code)) continue;
    taken.add(code);
    codes.push(code);
  }
  return codes;
}

/** For logs / audit / non-admin views: keep the prefix and the last 2 characters only. */
export function maskCardCode(code: string): string {
  const dash = code.lastIndexOf("-");
  const head = dash >= 0 ? code.slice(0, dash + 1) : "";
  const tail = dash >= 0 ? code.slice(dash + 1) : code;
  if (tail.length <= 2) return `${head}${"•".repeat(tail.length)}`;
  return `${head}${"•".repeat(tail.length - 2)}${tail.slice(-2)}`;
}

export class DuplicateCardCodeError extends Error {
  constructor() {
    super("duplicate_card_code");
    this.name = "DuplicateCardCodeError";
  }
}
