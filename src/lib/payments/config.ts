/**
 * Payment instructions (numbers / beneficiary) and owner-alert targets.
 * Precedence for every field: admin settings (payment-settings.json document) → env → default.
 * Pure: no I/O here, so it is unit-tested and safe to import from server components.
 */
import type { PaymentMethodId } from "./types";

/** Owner decision (2026-10-04): Whish and OMT both go to 70772968, beneficiary منذر أحمد حداره. */
export const DEFAULT_PAYMENT_NUMBER = "70772968";
export const DEFAULT_BENEFICIARY_AR = "منذر أحمد حداره";
export const DEFAULT_BENEFICIARY_EN = "Munzer Ahmad Haddara";
export const DEFAULT_OWNER_WHATSAPP = "96176532421";
export const DEFAULT_OWNER_EMAIL = "munzerhaddara2@gmail.com";

export type MethodSettings = {
  enabled: boolean;
  number: string;
  nameAr: string;
  nameEn: string;
};

export type PaymentSettings = Record<PaymentMethodId, MethodSettings>;

/** What the admin may store (every field optional; blank = fall back to env / default). */
export type StoredPaymentSettings = Partial<Record<PaymentMethodId, Partial<MethodSettings>>>;

type Env = Record<string, string | undefined>;

function pick(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) return trimmed;
  }
  return "";
}

function flag(raw: string | undefined, fallback: boolean): boolean {
  const value = raw?.trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "off", "no"].includes(value);
}

export function resolvePaymentSettings(stored: StoredPaymentSettings | null | undefined, env: Env = process.env): PaymentSettings {
  const nameAr = pick(env.PAYMENTS_BENEFICIARY_NAME_AR, DEFAULT_BENEFICIARY_AR);
  const nameEn = pick(env.PAYMENTS_BENEFICIARY_NAME_EN, DEFAULT_BENEFICIARY_EN);
  const method = (id: PaymentMethodId, numberEnv: string | undefined, enabledEnv: string | undefined): MethodSettings => {
    const saved = stored?.[id] ?? {};
    return {
      enabled: typeof saved.enabled === "boolean" ? saved.enabled : flag(enabledEnv, true),
      number: pick(saved.number, numberEnv, DEFAULT_PAYMENT_NUMBER),
      nameAr: pick(saved.nameAr, nameAr),
      nameEn: pick(saved.nameEn, nameEn),
    };
  };
  return {
    whish: method("whish", env.PAYMENTS_WHISH_NUMBER, env.PAYMENTS_WHISH_ENABLED),
    omt: method("omt", env.PAYMENTS_OMT_NUMBER, env.PAYMENTS_OMT_ENABLED),
  };
}

export function ownerWhatsAppNumber(env: Env = process.env): string {
  return pick(env.PAYMENTS_OWNER_WHATSAPP, DEFAULT_OWNER_WHATSAPP);
}

export function ownerEmailAddress(env: Env = process.env): string {
  return pick(env.PAYMENTS_OWNER_EMAIL, DEFAULT_OWNER_EMAIL);
}

/** Sanitises an admin PUT body: digits / + only for numbers, bounded names, booleans. */
export function sanitizeStoredSettings(input: unknown): StoredPaymentSettings {
  const out: StoredPaymentSettings = {};
  if (!input || typeof input !== "object") return out;
  for (const id of ["whish", "omt"] as const) {
    const raw = (input as Record<string, unknown>)[id];
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const next: Partial<MethodSettings> = {};
    if (typeof entry.enabled === "boolean") next.enabled = entry.enabled;
    if (typeof entry.number === "string") {
      const number = entry.number.replace(/[^\d+]/g, "").slice(0, 16);
      if (number && !/^\+?\d{7,15}$/.test(number)) throw new Error(`invalid ${id} number`);
      next.number = number;
    }
    for (const key of ["nameAr", "nameEn"] as const) {
      if (typeof entry[key] === "string") next[key] = (entry[key] as string).trim().slice(0, 120);
    }
    out[id] = next;
  }
  return out;
}
