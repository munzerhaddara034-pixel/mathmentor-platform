/**
 * Server glue for payment claims: Postgres pool, plan prices, admin-editable settings, notifications.
 * Payments need Postgres (DATABASE_URL); without it every entry point reports `unavailable`.
 */
import { createId } from "@/lib/ids";
import { readJsonFile, updateJsonFile } from "@/lib/dataDir";
import { getPool, isPostgresEnabled, ensureDatabaseReady } from "@/lib/db/pg";
import { resolvePlanAmount } from "@/lib/billing/orders";
import { appendAuditLog } from "@/lib/security/audit";
import type { PublicUser } from "@/lib/auth/store";
import { PRICING_REGIONS, getRegionalPricing, type PricingRegion } from "@/lib/pricing/plans";
import {
  resolvePaymentSettings,
  sanitizeStoredSettings,
  type PaymentSettings,
  type StoredPaymentSettings,
} from "./config";
import {
  confirmPayment,
  insertPayment,
  markNotified,
  purgeExpiredReceipts,
  rejectPayment,
  type Actor,
  type NewReceipt,
  type TxPool,
} from "./db";
import { notifyOwnerOfSubmission, notifyStudentOfReview } from "./notify";
import type { PaymentRecord } from "./types";
import type { ValidClaim } from "./validation";

const SETTINGS_DOC = "payment-settings.json";

export function paymentsAvailable(): boolean {
  return isPostgresEnabled();
}

export async function paymentsPool(): Promise<TxPool> {
  await ensureDatabaseReady();
  return getPool() as unknown as TxPool;
}

export async function readStoredPaymentSettings(): Promise<StoredPaymentSettings> {
  const stored = await readJsonFile<StoredPaymentSettings>(SETTINGS_DOC, {}, { persistFallback: false });
  return stored && typeof stored === "object" ? stored : {};
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    return resolvePaymentSettings(await readStoredPaymentSettings());
  } catch {
    return resolvePaymentSettings(null);
  }
}

export async function savePaymentSettings(input: unknown, actor: Actor, ip?: string | null): Promise<PaymentSettings> {
  const clean = sanitizeStoredSettings(input);
  const next = await updateJsonFile<StoredPaymentSettings>(SETTINGS_DOC, {}, () => clean);
  await appendAuditLog({ action: "payment.settings.update", actor, target: SETTINGS_DOC, ip, details: { settings: clean } });
  return resolvePaymentSettings(next);
}

export type PlanOption = {
  region: PricingRegion;
  planId: string;
  nameEn: string;
  nameAr: string;
  usdMonthly: number;
  usdTerm: number;
};

/** The regional plans shown on /subscribe, flattened for the "I paid" form. */
export function planOptions(): PlanOption[] {
  return PRICING_REGIONS.flatMap((region) =>
    getRegionalPricing(region).plans.map((plan) => ({
      region,
      planId: plan.id,
      nameEn: plan.nameEn,
      nameAr: plan.nameAr,
      usdMonthly: plan.usdMonthly,
      usdTerm: plan.usdTerm,
    })),
  );
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function adminPaymentLink(id: string): string {
  return `${appOrigin()}/admin/payments?id=${encodeURIComponent(id)}`;
}

export type SubmitOutcome =
  | { ok: true; payment: PaymentRecord }
  | { ok: false; status: number; error: string; errorAr: string; field?: string };

/** Inserts a PENDING claim (never activates anything), then alerts the owner. */
export async function submitPaymentClaim(input: {
  user: PublicUser;
  claim: ValidClaim;
  receipt?: NewReceipt | null;
  ip?: string | null;
}): Promise<SubmitOutcome> {
  const settings = await getPaymentSettings();
  if (!settings[input.claim.method].enabled) {
    return { ok: false, status: 400, field: "method", error: "This payment method is not available.", errorAr: "طريقة الدفع هذه غير متاحة." };
  }
  const resolved = await resolvePlanAmount(input.claim.plan, input.claim.period, { region: input.claim.region ?? undefined });
  if (!resolved.ok) return { ok: false, status: 400, field: "plan", error: resolved.error, errorAr: resolved.errorAr };

  const pool = await paymentsPool();
  const payment = await insertPayment(pool, {
    id: createId("pay"),
    userId: input.user.id,
    claim: input.claim,
    plan: resolved.plan.id,
    expectedAmountUsd: resolved.amount,
    receipt: input.receipt ?? null,
    actor: { id: input.user.id, email: input.user.email, role: input.user.role },
    ip: input.ip,
  });

  try {
    const sent = await notifyOwnerOfSubmission(payment, input.receipt ?? null, adminPaymentLink(payment.id));
    if (sent) await markNotified(pool, payment.id, "owner");
  } catch (error) {
    console.error("[mathmentor][payments] owner notification failed", error instanceof Error ? error.message : error);
  }
  return { ok: true, payment };
}

export async function confirmPaymentAsAdmin(input: {
  paymentId: string;
  admin: Actor;
  ip?: string | null;
  expiresAt?: Date | null;
  note?: string | null;
}) {
  const pool = await paymentsPool();
  const result = await confirmPayment(pool, input);
  if (!result.alreadyConfirmed) await notifyStudentSafely(pool, result.payment);
  return result;
}

export async function rejectPaymentAsAdmin(input: { paymentId: string; admin: Actor; note: string; ip?: string | null }) {
  const pool = await paymentsPool();
  const result = await rejectPayment(pool, input);
  if (!result.alreadyRejected) await notifyStudentSafely(pool, result.payment);
  return result;
}

async function notifyStudentSafely(pool: TxPool, payment: PaymentRecord) {
  try {
    const sent = await notifyStudentOfReview(payment);
    if (sent) await markNotified(pool, payment.id, "student");
  } catch (error) {
    console.error("[mathmentor][payments] student notification failed", error instanceof Error ? error.message : error);
  }
}

let lastPurgeAt = 0;

/** Retention: at most once a day per process, drop receipt bytes older than 12 months after review. */
export async function maybePurgeReceipts(pool: TxPool, now = Date.now()): Promise<void> {
  if (now - lastPurgeAt < 24 * 60 * 60 * 1000) return;
  lastPurgeAt = now;
  try {
    const purged = await purgeExpiredReceipts(pool, new Date(now));
    if (purged) {
      await appendAuditLog({ action: "payment.receipt.purge", actor: { id: "system", role: "system" }, details: { purged } });
    }
  } catch (error) {
    console.error("[mathmentor][payments] receipt purge failed", error instanceof Error ? error.message : error);
  }
}
