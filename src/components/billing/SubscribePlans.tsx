"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ManualTransferCheckout } from "@/components/billing/ManualTransferCheckout";
import { PricingOptions } from "@/components/billing/PricingOptions";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";
import { pickLang } from "@/lib/i18n/pick";
import { rich } from "@/lib/i18n/rich";
import {
  PRICING_REGIONS,
  formatRegionalPrice,
  formatUsdBand,
  planShowsPriceBand,
  getRegionalPricing,
  isPaymentMethod,
  isPricingRegion,
  pricingRegionFromCurriculumId,
  type PaymentMethod,
  type PricingRegion,
  type RegionalPlan,
} from "@/lib/pricing/plans";
import { paymentMethodLabel, type ManualTransferInstructions } from "@/lib/pricing/transfers";

type Period = "monthly" | "term";

type Order = {
  id: string;
  planId: string;
  planName: string;
  planNameAr: string;
  period: Period;
  amount: number;
  currency: string;
  status: "pending_payment" | "transfer_claimed" | "paid" | "cancelled";
  studentName: string;
  studentMarkedPaidAt?: string;
  paymentMethod?: PaymentMethod;
  pricingRegion?: PricingRegion;
};

type PriceInfo = {
  amount: number;
  currency: string;
  display: string;
  displayAr: string;
  configured: boolean;
};

type Props = {
  contactPhone?: string;
  contactNote?: string;
};

export function SubscribePlans({ contactPhone, contactNote }: Props) {
  const { curriculumId, curriculum, ready: curriculumReady } = useCurriculum();
  const { locale } = useI18n();
  const t = billingMessages[locale].plans;
  const isAr = locale === "ar";
  const [region, setRegion] = useState<PricingRegion>("lebanon");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("whish");
  const [authenticated, setAuthenticated] = useState(false);
  const [staff, setStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [errorAr, setErrorAr] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [instructions, setInstructions] = useState<ManualTransferInstructions | null>(null);
  const [price, setPrice] = useState<PriceInfo | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!curriculumReady) return;
    const next = pricingRegionFromCurriculumId(curriculumId);
    setRegion(next);
    setPaymentMethod(getRegionalPricing(next).defaultPaymentMethod);
  }, [curriculumId, curriculumReady]);

  const pricing = useMemo(() => getRegionalPricing(region), [region]);

  const loadSessionAndOrders = useCallback(async (opts?: { seedActive?: boolean }) => {
    setLoading(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      const sessionJson = (await sessionRes.json().catch(() => ({}))) as {
        ok?: boolean;
        user?: { role?: string };
      };
      const authed = Boolean(sessionJson.ok && sessionJson.user);
      setAuthenticated(authed);
      const isStaff = Boolean(
        sessionJson.user && (sessionJson.user.role === "teacher" || sessionJson.user.role === "admin"),
      );
      setStaff(isStaff);

      if (authed) {
        const ordersRes = await fetch("/api/billing/orders?pending=1", { credentials: "include" });
        const ordersJson = (await ordersRes.json().catch(() => ({}))) as { orders?: Order[] };
        if (ordersRes.ok && ordersJson.orders) {
          setPendingOrders(ordersJson.orders);
          if (opts?.seedActive && !isStaff) {
            const mine = ordersJson.orders.find((order) => order.status !== "paid");
            if (mine) setActiveOrder(mine);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessionAndOrders({ seedActive: true });
  }, [loadSessionAndOrders]);

  function changeRegion(next: PricingRegion) {
    setRegion(next);
    setPaymentMethod(getRegionalPricing(next).defaultPaymentMethod);
  }

  async function startPayment(plan: RegionalPlan, period: Period) {
    setBusy(true);
    setError(undefined);
    setErrorAr(undefined);
    setMessage(undefined);
    try {
      if (!authenticated) {
        window.location.href = `/login?next=${encodeURIComponent("/subscribe")}`;
        return;
      }
      const res = await fetch("/api/billing/subscribe-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          period,
          region,
          paymentMethod,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errorAr?: string;
        order?: Order;
        instructions?: ManualTransferInstructions;
        price?: PriceInfo;
        message?: string;
        messageAr?: string;
        paymentMethod?: PaymentMethod;
      };
      if (!res.ok || !json.ok || !json.order || !json.instructions) {
        setError(json.error || t.startFailed);
        setErrorAr(json.errorAr);
        return;
      }
      setActiveOrder(json.order);
      setInstructions(json.instructions);
      setPrice(json.price || null);
      if (json.paymentMethod && isPaymentMethod(json.paymentMethod)) {
        setPaymentMethod(json.paymentMethod);
      }
      setMessage(pickLang(locale, json.message, json.messageAr) || undefined);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function markTransferred(orderId: string) {
    setBusy(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      const res = await fetch("/api/billing/confirm-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "student_mark" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errorAr?: string;
        order?: Order;
        message?: string;
        messageAr?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error || t.markFailed);
        setErrorAr(json.errorAr);
        return;
      }
      if (json.order) setActiveOrder(json.order);
      setMessage(pickLang(locale, json.message, json.messageAr) || undefined);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.markFailed);
    } finally {
      setBusy(false);
    }
  }

  async function teacherConfirm(orderId: string) {
    setBusy(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      const res = await fetch("/api/billing/confirm-payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action: "teacher_confirm" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errorAr?: string;
        order?: Order;
        message?: string;
        messageAr?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error || t.confirmFailed);
        setErrorAr(json.errorAr);
        return;
      }
      setMessage(pickLang(locale, json.message, json.messageAr) || undefined);
      if (activeOrder?.id === orderId) setActiveOrder(json.order || null);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.confirmFailed);
    } finally {
      setBusy(false);
    }
  }

  const activeMethod: PaymentMethod = instructions?.method
    || (activeOrder?.paymentMethod && isPaymentMethod(activeOrder.paymentMethod)
      ? activeOrder.paymentMethod
      : paymentMethod);

  return (
    <div className="mm-mobile-stack">
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t.eyebrow}</p>
        <p>
          {rich(t.intro, {
            phone: <strong dir="ltr">96170772968</strong>,
            name: <strong>{isAr ? "منذر أحمد حداره" : "Munzer Ahmad Haddara"}</strong>,
          })}
        </p>
        <p className="muted">
          {fmt(t.introNote, { curriculum: isAr ? curriculum.labelAr : curriculum.labelEn })}
          {contactPhone ? fmt(t.support, { phone: contactPhone }) : ""}
        </p>
        {contactNote ? <p className="muted">{contactNote}</p> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t.region}</p>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {PRICING_REGIONS.map((id) => {
            const pack = getRegionalPricing(id);
            return (
              <button
                key={id}
                type="button"
                className={region === id ? "btn dark" : "btn"}
                onClick={() => changeRegion(id)}
              >
                {isAr ? pack.selectorAr : pack.selectorEn}
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {fmt(t.linked, { curriculum: isAr ? curriculum.shortAr : curriculum.shortEn })}
        </p>
        {(isAr ? pricing.notesAr : pricing.notesEn) ? (
          <p style={{ marginTop: 8 }}>{isAr ? pricing.notesAr : pricing.notesEn}</p>
        ) : null}
      </div>

      <div style={{ marginBottom: 16 }}>
        <PricingOptions region={region} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t.method}</p>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {(["whish", "western_union", "omt"] as const).map((method) => {
            const label = paymentMethodLabel(method);
            return (
              <button
                key={method}
                type="button"
                className={paymentMethod === method ? "btn dark" : "btn"}
                onClick={() => setPaymentMethod(method)}
              >
                {isAr ? label.ar : label.en}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <SkeletonBlock lines={4} label={t.loading} /> : null}
      {busy ? <SkeletonBlock lines={2} label={t.updating} /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {message ? <p className="success">{message}</p> : null}

      {!authenticated ? (
        <p className="muted">
          {rich(t.signInLead, { link: <Link href="/login?next=%2Fsubscribe">{t.signIn}</Link> })}
        </p>
      ) : null}

      {activeOrder && instructions && activeOrder.status !== "paid" ? (
        <ManualTransferCheckout
          method={activeMethod}
          amount={activeOrder.amount}
          currency={activeOrder.currency || "USD"}
          display={price?.display}
          displayAr={price?.displayAr}
          title={`${activeOrder.planName} · ${activeOrder.period === "monthly" ? t.monthly : t.term}`}
          titleAr={`${activeOrder.planNameAr} · ${activeOrder.period === "monthly" ? t.monthly : t.term}`}
          beneficiaryAr={instructions.beneficiaryAr}
          beneficiaryEn={instructions.beneficiaryEn}
          phone={instructions.phone}
          linesEn={instructions.linesEn}
          linesAr={instructions.linesAr}
          showTransferredButton={authenticated && !staff}
          transferredBusy={busy}
          claimed={activeOrder.status === "transfer_claimed" || Boolean(activeOrder.studentMarkedPaidAt)}
          onTransferred={() => void markTransferred(activeOrder.id)}
        />
      ) : null}

      {(staff || pendingOrders.length > 0) && pendingOrders.length > 0 ? (
        <div className="card" style={{ marginTop: 16, marginBottom: 16 }}>
          <h3>{t.pending}</h3>
          {pendingOrders.map((order) => {
            const method =
              order.paymentMethod && isPaymentMethod(order.paymentMethod) ? order.paymentMethod : "whish";
            const label = paymentMethodLabel(method);
            const regionLabel =
              order.pricingRegion && isPricingRegion(order.pricingRegion)
                ? getRegionalPricing(order.pricingRegion)
                : null;
            return (
              <div key={order.id} style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <p>
                  <strong>{isAr ? order.planNameAr : order.planName}</strong> · {order.studentName} · $
                  {order.amount} · {order.period === "monthly" ? t.monthly : t.term} · {isAr ? label.ar : label.en}
                  {regionLabel ? ` · ${isAr ? regionLabel.labelAr : regionLabel.labelEn}` : ""}
                  {order.status === "transfer_claimed" || order.studentMarkedPaidAt ? t.studentMarked : t.pendingState}
                </p>
                <p className="muted">{fmt(t.order, { id: order.id })}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!staff && order.status !== "transfer_claimed" ? (
                    <button
                      className="btn dark"
                      type="button"
                      disabled={busy}
                      onClick={() => void markTransferred(order.id)}
                    >
                      {t.transferred}
                    </button>
                  ) : null}
                  {staff ? (
                    <button
                      className="btn dark"
                      type="button"
                      disabled={busy}
                      onClick={() => void teacherConfirm(order.id)}
                    >
                      {t.confirm}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid two">
        {pricing.plans.map((plan) => (
          <article className="card" key={plan.id}>
            {(isAr ? plan.badgeAr || plan.badgeEn : plan.badgeEn || plan.badgeAr) ? (
              <span className="badge">{isAr ? plan.badgeAr || plan.badgeEn : plan.badgeEn || plan.badgeAr}</span>
            ) : null}
            <h2>{isAr ? plan.nameAr : plan.nameEn}</h2>
            <p style={{ fontSize: 28, margin: "8px 0" }}>
              {planShowsPriceBand(plan)
                ? formatUsdBand(plan.usdMonthlyMin, plan.usdMonthlyMax)
                : `$${plan.defaultChargeUSD}`}
              <span className="muted">{t.perMonth}</span>
            </p>
            {planShowsPriceBand(plan) ? (
              <p className="muted">
                {fmt(t.checkoutDefault, { n: plan.defaultChargeUSD })}
              </p>
            ) : null}
            {plan.sarMonthlyMin != null && plan.sarMonthlyMax != null ? (
              <p className="muted">
                {fmt(t.sar, {
                  v:
                    plan.sarMonthlyMin === plan.sarMonthlyMax
                      ? `${plan.sarMonthlyMin}`
                      : `${plan.sarMonthlyMin}–${plan.sarMonthlyMax}`,
                })}
              </p>
            ) : null}
            <p className="muted">
              {fmt(t.perTerm, { n: plan.usdTerm })}
              {planShowsPriceBand(plan) ? t.atDefault : ""} · {formatRegionalPrice(plan, "monthly")}
            </p>
            <ul style={{ paddingInlineStart: 18 }}>
              {(isAr ? plan.featuresAr : plan.featuresEn).map((feature) => (
                <li key={`${plan.id}-${feature}`}>{feature}</li>
              ))}
            </ul>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button
                className="btn dark"
                type="button"
                disabled={busy || !authenticated}
                onClick={() => void startPayment(plan, "monthly")}
              >
                {fmt(t.payMonthly, { n: plan.defaultChargeUSD })}
              </button>
              <button
                className="btn dark"
                type="button"
                disabled={busy || !authenticated}
                onClick={() => void startPayment(plan, "term")}
              >
                {fmt(t.payTerm, { n: plan.usdTerm })}
              </button>
            </div>
            {!authenticated ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {rich(t.signInLead, { link: <Link href="/login?next=%2Fsubscribe">{t.signIn}</Link> })}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <Link className="btn" href="/redeem">
          {t.redeem}
        </Link>
        <Link className="btn" href="/live">
          {t.book}
        </Link>
        <Link className="btn" href="/classroom">
          {t.classroom}
        </Link>
      </div>
    </div>
  );
}
