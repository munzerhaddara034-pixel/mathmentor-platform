/**
 * SQL layer for mm_payments / mm_payment_receipts. Every function takes the pool explicitly so the
 * same code runs against Neon in production and a throwaway Postgres in tests.
 *
 * Activation (confirmPayment) lives ONLY here and is only called from the admin confirm route.
 * Submitting a claim can only ever INSERT status = 'pending'.
 */
import type { PoolClient } from "pg";
import { withStoreLock } from "@/lib/dataDir";
import { AUTH_DOCUMENT_KEY, aiExpiryFromAuthDoc, applyPaidEntitlementToAuthDoc, type PublicUser } from "@/lib/auth/store";
import { planIdToSubscriptionType } from "@/lib/auth/tiers";
import { appendAuditLogTx } from "@/lib/security/audit";
import { computePeriod } from "./expiry";
import type { ReceiptMime } from "./receipt";
import type { AdminPaymentRow, PaymentRecord, PaymentStatus } from "./types";
import type { ValidClaim } from "./validation";
import { sanitizeRegionSignals, type RegionSignals } from "@/lib/pricing/regionSignals";
import type { PricingRegion } from "@/lib/pricing/plans";

export type TxPool = { connect(): Promise<PoolClient>; query: PoolClient["query"] };

export type Actor = { id: string; email?: string | null; role?: string | null };

export const RECEIPT_RETENTION_MONTHS = 12;
export const MAX_PENDING_PER_USER = 3;

export type PaymentErrorCode =
  | "duplicate_reference"
  | "pending_exists"
  | "too_many_pending"
  | "not_found"
  | "already_confirmed"
  | "already_rejected"
  | "user_not_found";

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly status: number;

  constructor(code: PaymentErrorCode, status: number) {
    super(code);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}

export async function runInTx<T>(pool: TxPool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const COLUMNS = `p.id, p.user_id, p.payer_name, p.payer_email, p.payer_phone, p.plan, p.period, p.pricing_region,
  p.expected_amount_usd::float8 AS expected_amount_usd, p.amount::float8 AS amount, p.currency, p.method,
  p.reference, p.reference_raw, to_char(p.transfer_date, 'YYYY-MM-DD') AS transfer_date, p.receipt_url, p.order_id,
  p.status, p.submitted_at, p.reviewed_at, p.reviewed_by, p.note, p.period_start, p.period_end,
  p.owner_notified_at, p.student_notified_at, p.region_sources, p.region_mismatch`;

type Row = Record<string, unknown>;

const iso = (value: unknown): string | null => (value instanceof Date ? value.toISOString() : value == null ? null : String(value));

export function rowToPayment(row: Row): PaymentRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    payerName: String(row.payer_name),
    payerEmail: (row.payer_email as string | null) ?? null,
    payerPhone: (row.payer_phone as string | null) ?? null,
    plan: String(row.plan),
    period: row.period === "term" ? "term" : "monthly",
    pricingRegion: (row.pricing_region as string | null) ?? null,
    regionSources: sanitizeRegionSignals(row.region_sources),
    regionMismatch: row.region_mismatch === true,
    expectedAmountUsd: Number(row.expected_amount_usd),
    amount: Number(row.amount),
    currency: "USD",
    method: row.method === "omt" ? "omt" : "whish",
    reference: String(row.reference),
    referenceRaw: String(row.reference_raw),
    transferDate: String(row.transfer_date),
    receiptUrl: (row.receipt_url as string | null) ?? null,
    orderId: (row.order_id as string | null) ?? null,
    status: row.status as PaymentStatus,
    submittedAt: iso(row.submitted_at) ?? "",
    reviewedAt: iso(row.reviewed_at),
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    periodStart: iso(row.period_start),
    periodEnd: iso(row.period_end),
    ownerNotifiedAt: iso(row.owner_notified_at),
    studentNotifiedAt: iso(row.student_notified_at),
  };
}

function uniqueViolation(error: unknown): string | null {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === "23505" ? pgError.constraint ?? "unique" : null;
}

export type NewReceipt = { mimeType: ReceiptMime; sizeBytes: number; sha256: string; bytes: Buffer };

export async function insertPayment(
  pool: TxPool,
  input: {
    id: string;
    userId: string;
    claim: ValidClaim;
    expectedAmountUsd: number;
    plan: string;
    /** Server-resolved region (regionSignals.ts). Only region names + source names + the flag are stored. */
    region?: { region: PricingRegion; sources: RegionSignals; mismatch: boolean } | null;
    receipt?: NewReceipt | null;
    actor: Actor;
    ip?: string | null;
  },
): Promise<PaymentRecord> {
  const { claim } = input;
  try {
    return await runInTx(pool, async (client) => {
      // Serialise one student's submissions so the open-claims cap cannot be raced.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mm_payments:${input.userId}`]);
      const open = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM mm_payments WHERE user_id = $1 AND status = 'pending'",
        [input.userId],
      );
      if ((open.rows[0]?.n ?? 0) >= MAX_PENDING_PER_USER) throw new PaymentError("too_many_pending", 429);
      const inserted = await client.query(
        `INSERT INTO mm_payments (id, user_id, payer_name, payer_email, payer_phone, plan, period, pricing_region,
           expected_amount_usd, amount, currency, method, reference, reference_raw, transfer_date, receipt_url, order_id, status,
           region_sources, region_mismatch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'USD', $11, $12, $13, $14::date, $15, $16, 'pending', $17::jsonb, $18)
         RETURNING ${COLUMNS.replace(/\bp\./g, "")}`,
        [
          input.id,
          input.userId,
          claim.payerName,
          claim.payerEmail,
          claim.payerPhone,
          input.plan,
          claim.period,
          input.region?.region ?? null,
          input.expectedAmountUsd,
          claim.amount,
          claim.method,
          claim.reference,
          claim.referenceRaw,
          claim.transferDate,
          input.receipt ? `/api/payments/${encodeURIComponent(input.id)}/receipt` : null,
          claim.orderId,
          JSON.stringify(sanitizeRegionSignals(input.region?.sources)),
          input.region?.mismatch === true,
        ],
      );
      if (input.receipt) {
        await client.query(
          `INSERT INTO mm_payment_receipts (payment_id, mime_type, size_bytes, sha256, bytes) VALUES ($1, $2, $3, $4, $5)`,
          [input.id, input.receipt.mimeType, input.receipt.sizeBytes, input.receipt.sha256, input.receipt.bytes],
        );
      }
      await appendAuditLogTx(client, {
        action: "payment.submit",
        actor: input.actor,
        target: input.id,
        ip: input.ip,
        details: {
          plan: input.plan,
          period: claim.period,
          amount: claim.amount,
          expectedAmountUsd: input.expectedAmountUsd,
          method: claim.method,
          reference: claim.reference,
          hasReceipt: Boolean(input.receipt),
        },
      });
      return rowToPayment(inserted.rows[0] as Row);
    });
  } catch (error) {
    const constraint = uniqueViolation(error);
    if (constraint === "mm_payments_method_reference_active") throw new PaymentError("duplicate_reference", 409);
    if (constraint === "mm_payments_one_pending_per_plan") throw new PaymentError("pending_exists", 409);
    throw error;
  }
}

export async function getPayment(pool: TxPool, id: string): Promise<PaymentRecord | null> {
  const result = await pool.query(`SELECT ${COLUMNS} FROM mm_payments p WHERE p.id = $1`, [id]);
  return result.rows[0] ? rowToPayment(result.rows[0] as Row) : null;
}

export async function listUserPayments(pool: TxPool, userId: string, limit = 30): Promise<PaymentRecord[]> {
  const result = await pool.query(
    `SELECT ${COLUMNS} FROM mm_payments p WHERE p.user_id = $1 ORDER BY p.submitted_at DESC LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map((row) => rowToPayment(row as Row));
}

export async function listPaymentsForAdmin(
  pool: TxPool,
  opts: { status: PaymentStatus; limit?: number },
): Promise<AdminPaymentRow[]> {
  const order = opts.status === "pending" ? "p.submitted_at ASC" : "p.reviewed_at DESC";
  const result = await pool.query(
    `SELECT ${COLUMNS},
            (r.payment_id IS NOT NULL) AS has_receipt,
            (r.purged_at IS NOT NULL) AS receipt_purged,
            r.sha256 AS receipt_sha256,
            CASE WHEN r.sha256 IS NULL THEN 0 ELSE
              (SELECT count(*)::int FROM mm_payment_receipts r2 WHERE r2.sha256 = r.sha256 AND r2.payment_id <> p.id) END
              AS duplicate_receipt_count
     FROM mm_payments p
     LEFT JOIN mm_payment_receipts r ON r.payment_id = p.id
     WHERE p.status = $1
     ORDER BY ${order}
     LIMIT $2`,
    [opts.status, Math.min(Math.max(opts.limit ?? 100, 1), 200)],
  );
  return result.rows.map((raw) => {
    const row = raw as Row;
    const payment = rowToPayment(row);
    return {
      ...payment,
      hasReceipt: Boolean(row.has_receipt),
      receiptPurged: Boolean(row.receipt_purged),
      receiptSha256: (row.receipt_sha256 as string | null) ?? null,
      duplicateReceiptCount: Number(row.duplicate_receipt_count ?? 0),
      amountMismatch: Math.abs(payment.amount - payment.expectedAmountUsd) >= 0.01,
    };
  });
}

export async function countPending(pool: TxPool): Promise<number> {
  const result = await pool.query<{ n: number }>("SELECT count(*)::int AS n FROM mm_payments WHERE status = 'pending'");
  return result.rows[0]?.n ?? 0;
}

export async function getReceipt(
  pool: TxPool,
  paymentId: string,
): Promise<{ userId: string; mimeType: string; bytes: Buffer | null; purged: boolean } | null> {
  const result = await pool.query<{ user_id: string; mime_type: string; bytes: Buffer | null; purged_at: Date | null }>(
    `SELECT p.user_id, r.mime_type, r.bytes, r.purged_at
     FROM mm_payment_receipts r JOIN mm_payments p ON p.id = r.payment_id WHERE r.payment_id = $1`,
    [paymentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { userId: row.user_id, mimeType: row.mime_type, bytes: row.bytes, purged: Boolean(row.purged_at) };
}

export async function markNotified(pool: TxPool, id: string, who: "owner" | "student"): Promise<void> {
  const column = who === "owner" ? "owner_notified_at" : "student_notified_at";
  await pool.query(`UPDATE mm_payments SET ${column} = now() WHERE id = $1`, [id]);
}

/** Owner decision: keep receipt images 12 months after review, then drop the bytes (hash + metadata stay). */
export async function purgeExpiredReceipts(pool: TxPool, now = new Date(), months = RECEIPT_RETENTION_MONTHS): Promise<number> {
  const result = await pool.query(
    `UPDATE mm_payment_receipts r SET bytes = NULL, purged_at = $1
     FROM mm_payments p
     WHERE p.id = r.payment_id AND r.bytes IS NOT NULL AND p.status <> 'pending'
       AND p.reviewed_at < ($1::timestamptz - make_interval(months => $2::int))`,
    [now, months],
  );
  return result.rowCount ?? 0;
}

async function lockPayment(client: PoolClient, id: string): Promise<PaymentRecord> {
  const result = await client.query(`SELECT ${COLUMNS} FROM mm_payments p WHERE p.id = $1 FOR UPDATE`, [id]);
  if (!result.rows[0]) throw new PaymentError("not_found", 404);
  return rowToPayment(result.rows[0] as Row);
}

/** Latest confirmed live-only period for the user (LIVE_TIER plans have no aiExpiresAt). */
async function currentLiveExpiry(client: PoolClient, userId: string, excludeId: string): Promise<string | null> {
  const result = await client.query<{ plan: string; period_end: Date }>(
    "SELECT plan, period_end FROM mm_payments WHERE user_id = $1 AND status = 'confirmed' AND id <> $2 AND period_end IS NOT NULL",
    [userId, excludeId],
  );
  let latest: number | null = null;
  for (const row of result.rows) {
    if (planIdToSubscriptionType(row.plan) !== "LIVE_TIER") continue;
    const at = row.period_end.getTime();
    if (latest == null || at > latest) latest = at;
  }
  return latest == null ? null : new Date(latest).toISOString();
}

export type ConfirmResult = { payment: PaymentRecord; alreadyConfirmed: boolean; user?: PublicUser };

/**
 * Admin confirm: ONE transaction locks the payment row, then the auth.json document, applies the
 * entitlement exactly once, marks the payment confirmed and writes the audit row. A second call (double
 * click, two admins, retry) waits on the row lock, then sees "confirmed" and changes nothing.
 */
export async function confirmPayment(
  pool: TxPool,
  input: { paymentId: string; admin: Actor; ip?: string | null; expiresAt?: Date | null; note?: string | null; now?: Date },
): Promise<ConfirmResult> {
  const now = input.now ?? new Date();
  return withStoreLock(AUTH_DOCUMENT_KEY, () =>
    runInTx(pool, async (client) => {
      const payment = await lockPayment(client, input.paymentId);
      if (payment.status === "confirmed") return { payment, alreadyConfirmed: true };
      if (payment.status === "rejected") throw new PaymentError("already_rejected", 409);

      const doc = await client.query<{ data: unknown }>("SELECT data FROM mm_documents WHERE key = $1 FOR UPDATE", [AUTH_DOCUMENT_KEY]);
      if (!doc.rows[0]) throw new PaymentError("user_not_found", 404);
      const raw = doc.rows[0].data;
      const tier = planIdToSubscriptionType(payment.plan);
      const current = tier === "LIVE_TIER" ? await currentLiveExpiry(client, payment.userId, payment.id) : aiExpiryFromAuthDoc(raw, payment.userId);
      const period = computePeriod(current, payment.period, now, input.expiresAt ?? null);
      const applied = applyPaidEntitlementToAuthDoc(raw, payment.userId, payment.plan, period.end);
      if (!applied.user) throw new PaymentError("user_not_found", 404);

      await client.query("UPDATE mm_documents SET data = $2::jsonb, updated_at = now() WHERE key = $1", [
        AUTH_DOCUMENT_KEY,
        JSON.stringify(applied.doc),
      ]);
      const updated = await client.query(
        `UPDATE mm_payments p SET status = 'confirmed', reviewed_at = $2, reviewed_by = $3, period_start = $4, period_end = $5,
                note = COALESCE($6, p.note)
         WHERE p.id = $1 AND p.status = 'pending'
         RETURNING ${COLUMNS}`,
        [payment.id, now, input.admin.id, period.start, period.end, input.note ?? null],
      );
      if (updated.rowCount !== 1) throw new PaymentError("already_confirmed", 409);
      await appendAuditLogTx(client, {
        action: "payment.confirm",
        actor: input.admin,
        target: payment.id,
        ip: input.ip,
        details: {
          userId: payment.userId,
          plan: payment.plan,
          period: payment.period,
          amount: payment.amount,
          expectedAmountUsd: payment.expectedAmountUsd,
          method: payment.method,
          reference: payment.reference,
          previousExpiry: current,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          expiryOverride: Boolean(input.expiresAt),
        },
        now,
      });
      return { payment: rowToPayment(updated.rows[0] as Row), alreadyConfirmed: false, user: applied.user };
    }),
  );
}

export async function rejectPayment(
  pool: TxPool,
  input: { paymentId: string; admin: Actor; note: string; ip?: string | null; now?: Date },
): Promise<{ payment: PaymentRecord; alreadyRejected: boolean }> {
  const now = input.now ?? new Date();
  return runInTx(pool, async (client) => {
    const payment = await lockPayment(client, input.paymentId);
    if (payment.status === "rejected") return { payment, alreadyRejected: true };
    if (payment.status === "confirmed") throw new PaymentError("already_confirmed", 409);
    const updated = await client.query(
      `UPDATE mm_payments p SET status = 'rejected', reviewed_at = $2, reviewed_by = $3, note = $4
       WHERE p.id = $1 AND p.status = 'pending' RETURNING ${COLUMNS}`,
      [payment.id, now, input.admin.id, input.note],
    );
    if (updated.rowCount !== 1) throw new PaymentError("already_rejected", 409);
    await appendAuditLogTx(client, {
      action: "payment.reject",
      actor: input.admin,
      target: payment.id,
      ip: input.ip,
      details: { userId: payment.userId, plan: payment.plan, amount: payment.amount, method: payment.method, reference: payment.reference, note: input.note },
      now,
    });
    return { payment: rowToPayment(updated.rows[0] as Row), alreadyRejected: false };
  });
}
