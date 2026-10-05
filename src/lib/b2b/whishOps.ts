/**
 * Staff Whish payment ops — manual transfer confirmations for activation queue.
 * Whish only. Wallet: whishTransferPhone / whishTransferNameAr helpers.
 */

import { createId } from "@/lib/ids";
import { readJsonFile, withDocumentLock, writeJsonFile } from "@/lib/dataDir";
import { notifyStaff } from "@/lib/notifications/store";
import { whishTransferNameAr, whishTransferPhone } from "@/lib/whish/client";

const FILE = "b2b-whish-payments.json";

export type B2bWhishPaymentStatus = "pending_activation" | "activated" | "cancelled";

export type B2bWhishPayment = {
  id: string;
  referenceId: string;
  note?: string;
  planLabel: string;
  amountUsd: number;
  walletPhone: string;
  walletNameAr: string;
  status: B2bWhishPaymentStatus;
  recordedByUserId: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
};

type Store = { payments: B2bWhishPayment[] };

async function readStore(): Promise<Store> {
  const data = await readJsonFile<Store>(FILE, { payments: [] });
  if (!Array.isArray(data.payments)) return { payments: [] };
  return data;
}

async function writeStore(store: Store) {
  await writeJsonFile(FILE, store);
}

export async function listB2bWhishPayments(limit = 40) {
  const store = await readStore();
  return store.payments
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function recordB2bWhishPayment(input: {
  referenceId: string;
  note?: string;
  planLabel: string;
  amountUsd: number;
  recordedByUserId: string;
  recordedByName: string;
}) {
  const referenceId = input.referenceId.trim();
  if (!referenceId) {
    return { ok: false as const, error: "Reference ID required.", errorAr: "يلزم رقم المرجع." };
  }
  const amountUsd = Number(input.amountUsd);
  if (!(Number.isFinite(amountUsd) && amountUsd > 0)) {
    return { ok: false as const, error: "Valid amount required.", errorAr: "يلزم مبلغ صحيح." };
  }
  const planLabel = input.planLabel.trim() || "اشتراك";
  const now = new Date().toISOString();
  const payment: B2bWhishPayment = {
    id: createId("b2bpay"),
    referenceId,
    note: input.note?.trim() || undefined,
    planLabel,
    amountUsd,
    walletPhone: whishTransferPhone(),
    walletNameAr: whishTransferNameAr(),
    status: "pending_activation",
    recordedByUserId: input.recordedByUserId,
    recordedByName: input.recordedByName,
    createdAt: now,
    updatedAt: now,
  };

  await withDocumentLock(FILE, async () => {
    const store = await readStore();
    store.payments.unshift(payment);
    await writeStore(store);
  });

  await notifyStaff({
    kind: "whish_payment",
    title: "Whish payment — activate account & card",
    titleAr: "دفعة Whish — فعّل الحساب وأصدر بطاقة الاشتراك",
    body: `${payment.planLabel} · $${payment.amountUsd} · ref ${payment.referenceId}${payment.note ? ` · ${payment.note}` : ""}`,
    bodyAr: `${payment.planLabel} · ${payment.amountUsd}$ · مرجع ${payment.referenceId}${payment.note ? ` · ${payment.note}` : ""} — فعّل الحساب من /admin وولّد بطاقة الاشتراك.`,
    href: "/admin/b2b-manager",
    relatedId: payment.id,
  });

  return { ok: true as const, payment };
}
