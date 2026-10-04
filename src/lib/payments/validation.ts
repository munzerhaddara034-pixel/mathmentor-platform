/**
 * Pure validation for the "I paid" form (unit-tested). zod schema + normalisers.
 * The server never trusts the amount: the expected price is computed separately from the plan.
 */
import { z } from "zod";
import { PAYMENT_CURRENCY, PAYMENT_METHODS, PAYMENT_PERIODS } from "./types";

export const REFERENCE_PATTERN = /^[A-Z0-9][A-Z0-9._/-]{2,63}$/;
export const TRANSFER_DATE_MAX_AGE_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Trim, uppercase, drop whitespace. "ab 12-34 " → "AB12-34". */
export function normalizeReference(raw: string): string {
  return raw.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Phone → "+<country><national>" (8–15 digits). Lebanese local numbers (7/8 digits, optional leading 0)
 * get +961, same rules as the WhatsApp adapter. Returns null when it is not a plausible number.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 8) digits = `961${digits.slice(1)}`;
  else if (digits.length === 7 || digits.length === 8) digits = `961${digits}`;
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Calendar date (YYYY-MM-DD) in Asia/Beirut for `now`. */
export function beirutDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftDate(isoDate: string, days: number): string {
  const base = Date.parse(`${isoDate}T00:00:00Z`);
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

export function transferDateProblem(value: string, now: Date): "invalid" | "future" | "too_old" | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return "invalid";
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) return "invalid";
  const today = beirutDate(now);
  if (value > shiftDate(today, 1)) return "future";
  if (value < shiftDate(today, -TRANSFER_DATE_MAX_AGE_DAYS)) return "too_old";
  return null;
}

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined));

export const paymentClaimSchema = z
  .object({
    payerName: z.string().trim().min(2).max(120),
    payerEmail: optionalText(254).pipe(z.string().email().optional()),
    payerPhone: optionalText(32),
    plan: z.string().trim().min(1).max(40),
    period: z.enum(PAYMENT_PERIODS),
    region: z.enum(["lebanon", "gcc", "international", "admissions_us"]).optional(),
    amount: z.coerce.number().positive().max(100_000).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "max 2 decimals"),
    currency: z.literal(PAYMENT_CURRENCY).default(PAYMENT_CURRENCY),
    method: z.enum(PAYMENT_METHODS),
    reference: z.string().max(100),
    transferDate: z.string().max(10),
    orderId: optionalText(80),
  })
  .strict();

export type PaymentClaimInput = z.input<typeof paymentClaimSchema>;

export type ValidClaim = {
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  plan: string;
  period: (typeof PAYMENT_PERIODS)[number];
  region: "lebanon" | "gcc" | "international" | "admissions_us" | null;
  amount: number;
  currency: typeof PAYMENT_CURRENCY;
  method: (typeof PAYMENT_METHODS)[number];
  reference: string;
  referenceRaw: string;
  transferDate: string;
  orderId: string | null;
};

export type ClaimValidation = { ok: true; value: ValidClaim } | { ok: false; field: string; error: string };

export function validatePaymentClaim(input: unknown, now = new Date()): ClaimValidation {
  const parsed = paymentClaimSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, field: String(issue?.path?.[0] ?? "form"), error: issue?.message ?? "invalid" };
  }
  const data = parsed.data;
  const reference = normalizeReference(data.reference);
  if (!REFERENCE_PATTERN.test(reference)) return { ok: false, field: "reference", error: "invalid reference" };
  const phone = data.payerPhone ? normalizePhone(data.payerPhone) : null;
  if (data.payerPhone && !phone) return { ok: false, field: "payerPhone", error: "invalid phone" };
  if (!phone && !data.payerEmail) return { ok: false, field: "payerPhone", error: "email or phone required" };
  const dateProblem = transferDateProblem(data.transferDate, now);
  if (dateProblem) return { ok: false, field: "transferDate", error: dateProblem };
  return {
    ok: true,
    value: {
      payerName: data.payerName,
      payerEmail: data.payerEmail?.toLowerCase() ?? null,
      payerPhone: phone,
      plan: data.plan,
      period: data.period,
      region: data.region ?? null,
      amount: Math.round(data.amount * 100) / 100,
      currency: PAYMENT_CURRENCY,
      method: data.method,
      reference,
      referenceRaw: data.reference.trim().slice(0, 100),
      transferDate: data.transferDate,
      orderId: data.orderId ?? null,
    },
  };
}

/** Admin "Not received" note: required, bounded. */
export function validateRejectNote(note: unknown): { ok: true; note: string } | { ok: false; error: string } {
  if (typeof note !== "string" || !note.trim()) return { ok: false, error: "note required" };
  if (note.trim().length > 1000) return { ok: false, error: "note too long" };
  return { ok: true, note: note.trim() };
}

/** Admin confirm body: optional expiry override (date or ISO) + optional note. */
export function validateConfirmBody(body: unknown, now = new Date()):
  | { ok: true; expiresAt: Date | null; note: string | null }
  | { ok: false; error: string } {
  const value = (body && typeof body === "object" ? body : {}) as { expiresAt?: unknown; note?: unknown };
  let expiresAt: Date | null = null;
  if (value.expiresAt != null && value.expiresAt !== "") {
    if (typeof value.expiresAt !== "string") return { ok: false, error: "invalid expiresAt" };
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(value.expiresAt) ? `${value.expiresAt}T21:59:59.000Z` : value.expiresAt;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { ok: false, error: "invalid expiresAt" };
    if (parsed.getTime() <= now.getTime()) return { ok: false, error: "expiresAt must be in the future" };
    if (parsed.getTime() > now.getTime() + 400 * DAY_MS) return { ok: false, error: "expiresAt too far" };
    expiresAt = parsed;
  }
  let note: string | null = null;
  if (value.note != null && value.note !== "") {
    if (typeof value.note !== "string" || value.note.trim().length > 1000) return { ok: false, error: "invalid note" };
    note = value.note.trim() || null;
  }
  return { ok: true, expiresAt, note };
}
