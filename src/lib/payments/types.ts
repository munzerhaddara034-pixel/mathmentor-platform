/** Manual payment claims (mm_payments). Pure types, shared by server code and client components. */
import type { RegionSignals } from "@/lib/pricing/regionSignals";

export const PAYMENT_METHODS = ["whish", "omt"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["pending", "confirmed", "rejected"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PERIODS = ["monthly", "term"] as const;
export type PaymentPeriod = (typeof PAYMENT_PERIODS)[number];

/** Owner decision: USD only. */
export const PAYMENT_CURRENCY = "USD" as const;

export type PaymentRecord = {
  id: string;
  userId: string;
  payerName: string;
  payerEmail: string | null;
  payerPhone: string | null;
  plan: string;
  period: PaymentPeriod;
  /** Region resolved SERVER-side at submission (never taken from the browser). */
  pricingRegion: string | null;
  /** Which signal named which region (location / ip / phone) — region names only, never coordinates. */
  regionSources: RegionSignals;
  /** Signals disagreed: the most expensive region was charged and the claim needs the owner's review. */
  regionMismatch: boolean;
  expectedAmountUsd: number;
  amount: number;
  currency: typeof PAYMENT_CURRENCY;
  method: PaymentMethodId;
  reference: string;
  referenceRaw: string;
  transferDate: string;
  receiptUrl: string | null;
  orderId: string | null;
  status: PaymentStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  note: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  ownerNotifiedAt: string | null;
  studentNotifiedAt: string | null;
};

/** Admin list row: payment + receipt facts (never the bytes). */
export type AdminPaymentRow = PaymentRecord & {
  hasReceipt: boolean;
  receiptPurged: boolean;
  receiptSha256: string | null;
  /** Other payments that uploaded the very same image (fraud signal). */
  duplicateReceiptCount: number;
  amountMismatch: boolean;
};

export function isPaymentMethodId(value: unknown): value is PaymentMethodId {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** Region preselected on the "I paid" form (most students pay from Lebanon). */
export const DEFAULT_PAYMENT_PERIOD_REGION = "lebanon" as const;
