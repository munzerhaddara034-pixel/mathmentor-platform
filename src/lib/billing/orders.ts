import { createId } from "@/lib/ids";
import { readJsonFile, withDocumentLock, writeJsonFile } from "@/lib/dataDir";
import { setUserEntitlement } from "@/lib/auth/store";
import { liveCreditsForPlan, planIdToSubscriptionType } from "@/lib/auth/tiers";
import { addLedger } from "@/lib/billing/store";
import { priceFromUsd, whishTransferInstructionsForAmount } from "@/lib/whish/client";
import {
  getRegionalPlan,
  isPaymentMethod,
  isPricingRegion,
  isRegionalPlanId,
  type PaymentMethod,
  type PricingRegion,
} from "@/lib/pricing/plans";
import { buildManualTransferInstructions, toCheckoutTransfer } from "@/lib/pricing/transfers";
import type { RegionResolution, RegionSignals } from "@/lib/pricing/regionSignals";

const FILE = "whish-orders.json";

export type SubscribePeriod = "monthly" | "term";

export type WhishOrderStatus = "pending_payment" | "transfer_claimed" | "paid" | "cancelled";

export type WhishSubscriptionOrder = {
  id: string;
  kind: "subscription";
  userId: string;
  studentName: string;
  studentPhone: string;
  planId: string;
  planName: string;
  planNameAr: string;
  period: SubscribePeriod;
  amount: number;
  currency: "USD";
  status: WhishOrderStatus;
  paymentProvider: "manual";
  paymentMethod: PaymentMethod;
  /** Resolved server-side (regionSignals.ts) — never the browser's choice. */
  pricingRegion?: PricingRegion;
  /** Which signal named which region (region names only, never coordinates / IP). */
  regionSources?: RegionSignals;
  /** Signals disagreed → most expensive region charged; flagged for the owner's review. */
  regionMismatch?: boolean;
  studentMarkedPaidAt?: string;
  paidAt?: string;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type OrdersStore = { orders: WhishSubscriptionOrder[] };

function seed(): OrdersStore {
  return { orders: [] };
}

async function readOrders(): Promise<OrdersStore> {
  const data = await readJsonFile<OrdersStore>(FILE, seed());
  if (!Array.isArray(data.orders)) return seed();
  return data;
}

async function writeOrders(store: OrdersStore) {
  await writeJsonFile(FILE, store);
}

export function periodDays(period: SubscribePeriod) {
  return period === "monthly" ? 30 : 90;
}

export async function resolvePlanAmount(
  planId: string,
  period: SubscribePeriod,
  opts?: { region?: PricingRegion },
) {
  const region = opts?.region && isPricingRegion(opts.region) ? opts.region : undefined;

  if (region && isRegionalPlanId(planId)) {
    const plan = getRegionalPlan(region, planId);
    const amount = period === "monthly" ? plan.usdMonthly : plan.usdTerm;
    if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0)) {
      return { ok: false as const, error: "Plan price not configured.", errorAr: "سعر الباقة غير مضبوط." };
    }
    const labelEn = `${plan.nameEn} · ${period}`;
    const labelAr = `${plan.nameAr} · ${period === "monthly" ? "شهري" : "فصل"}`;
    return {
      ok: true as const,
      plan: {
        id: plan.id,
        name: plan.nameEn,
        arabicName: plan.nameAr,
        usdMonthly: plan.usdMonthly,
        usdTerm: plan.usdTerm,
        includes: plan.featuresEn.join(" · "),
        tier: plan.tier,
        liveCredits: plan.liveCredits,
      },
      amount,
      region,
      price: priceFromUsd(amount, { labelEn, labelAr }),
      transfer: whishTransferInstructionsForAmount(amount, {
        labelEn,
        labelAr,
        context: "subscription",
      }),
    };
  }

  // Single price source: only REGIONAL_PRICING (src/lib/pricing/plans.ts) can price a checkout.
  // The old settings.ts plans (29–99 USD) are no longer sold; their ids only drive activation codes.
  if (isRegionalPlanId(planId)) {
    return { ok: false as const, error: "Choose a pricing region.", errorAr: "اختر المنطقة أولاً." };
  }
  return {
    ok: false as const,
    error: "This plan is no longer sold. Choose a plan on /subscribe.",
    errorAr: "هذه الباقة لم تعد متاحة. اختر باقة من صفحة الاشتراك.",
  };
}

export async function createSubscribeOrder(input: {
  userId: string;
  studentName: string;
  studentPhone: string;
  planId: string;
  period: SubscribePeriod;
  /** Server-side resolution (resolveRegionForRequest). There is deliberately no client "region" input. */
  region: RegionResolution;
  paymentMethod?: PaymentMethod;
}) {
  if (!input.region.ok) {
    return {
      ok: false as const,
      error: "Enable location so we can apply your country's prices.",
      errorAr: "فعّل الموقع لنطبّق أسعار بلدك.",
    };
  }
  const region = input.region;
  return withDocumentLock(FILE, async () => {
    const paymentMethod: PaymentMethod = isPaymentMethod(input.paymentMethod)
      ? input.paymentMethod
      : "whish";
    const resolved = await resolvePlanAmount(input.planId, input.period, { region: region.region });
    if (!resolved.ok) return resolved;

    const now = new Date().toISOString();
    const order: WhishSubscriptionOrder = {
      id: createId("sub"),
      kind: "subscription",
      userId: input.userId,
      studentName: input.studentName,
      studentPhone: input.studentPhone,
      planId: resolved.plan.id,
      planName: resolved.plan.name,
      planNameAr: resolved.plan.arabicName,
      period: input.period,
      amount: resolved.amount,
      currency: "USD",
      status: "pending_payment",
      paymentProvider: "manual",
      paymentMethod,
      pricingRegion: resolved.region,
      regionSources: region.sources,
      regionMismatch: region.mismatch,
      createdAt: now,
      updatedAt: now,
    };

    const store = await readOrders();
    store.orders.unshift(order);
    await writeOrders(store);

    const manual = buildManualTransferInstructions(paymentMethod, resolved.amount, {
      labelEn: `${resolved.plan.name} · ${input.period}`,
      labelAr: `${resolved.plan.arabicName} · ${input.period === "monthly" ? "شهري" : "فصل"}`,
    });

    return {
      ok: true as const,
      order,
      transfer: toCheckoutTransfer(manual),
      instructions: manual,
      price: resolved.price,
    };
  });
}

export async function getOrder(id: string) {
  const store = await readOrders();
  return store.orders.find((item) => item.id === id);
}

export async function listOrders(opts?: {
  userId?: string;
  status?: WhishOrderStatus | WhishOrderStatus[];
  pendingOnly?: boolean;
}) {
  const store = await readOrders();
  let list = store.orders;
  if (opts?.userId) list = list.filter((item) => item.userId === opts.userId);
  if (opts?.pendingOnly) {
    list = list.filter((item) => item.status === "pending_payment" || item.status === "transfer_claimed");
  } else if (opts?.status) {
    const statuses = Array.isArray(opts.status) ? opts.status : [opts.status];
    list = list.filter((item) => statuses.includes(item.status));
  }
  return list;
}

export async function patchOrder(id: string, patch: Partial<WhishSubscriptionOrder>) {
  return withDocumentLock(FILE, async () => {
    const store = await readOrders();
    const index = store.orders.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    store.orders[index] = {
      ...store.orders[index],
      ...patch,
      id: store.orders[index].id,
      updatedAt: new Date().toISOString(),
    };
    await writeOrders(store);
    return store.orders[index];
  });
}

export async function markTransferClaimed(orderId: string) {
  return withDocumentLock(FILE, async () => {
    const order = await getOrder(orderId);
    if (!order) return { ok: false as const, error: "Order not found.", errorAr: "الطلب غير موجود." };
    if (order.status === "paid") {
      return { ok: true as const, alreadyPaid: true as const, order };
    }
    if (order.status === "cancelled") {
      return { ok: false as const, error: "Order cancelled.", errorAr: "الطلب ملغى." };
    }
    const updated = await patchOrder(orderId, {
      status: "transfer_claimed",
      studentMarkedPaidAt: new Date().toISOString(),
    });
    return { ok: true as const, alreadyPaid: false as const, order: updated || order };
  });
}

export async function confirmSubscribePayment(orderId: string, confirmedBy: string) {
  return withDocumentLock([FILE, "auth.json", "billing.json"], async () => {
    const order = await getOrder(orderId);
    if (!order) return { ok: false as const, error: "Order not found.", errorAr: "الطلب غير موجود." };
    if (order.status === "paid") {
      return { ok: true as const, alreadyPaid: true as const, order };
    }
    if (order.status === "cancelled") {
      return { ok: false as const, error: "Order cancelled.", errorAr: "الطلب ملغى." };
    }

    const days = periodDays(order.period);
    const activated = await setUserEntitlement(order.userId, order.planId, { days });
    if (!activated) {
      return { ok: false as const, error: "User not found.", errorAr: "المستخدم غير موجود." };
    }

    const paidAt = new Date().toISOString();
    const updated = await patchOrder(orderId, {
      status: "paid",
      paidAt,
      confirmedBy,
    });

    try {
      const type = planIdToSubscriptionType(order.planId);
      const hours = liveCreditsForPlan(order.planId);
      await addLedger({
        userId: order.userId,
        kind: type === "LIVE_TIER" ? "topup" : type === "AI_TIER" ? "ai_grant" : "activation",
        hoursDelta: hours,
        code: `WHISH-${order.id}`,
        relatedId: order.id,
        description: `Whish subscription ${order.planName} (${order.period}) · $${order.amount}`,
        descriptionAr: `اشتراك Whish ${order.planNameAr} (${order.period === "monthly" ? "شهري" : "فصل"}) · $${order.amount}`,
      });
    } catch {
      /* ledger optional */
    }

    return { ok: true as const, alreadyPaid: false as const, order: updated || order, user: activated };
  });
}
