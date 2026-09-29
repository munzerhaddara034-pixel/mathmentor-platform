"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ManualTransferCheckout } from "@/components/billing/ManualTransferCheckout";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useCurriculum } from "@/components/curriculum/CurriculumProvider";
import {
  PRICING_REGIONS,
  formatPrivateHourBand,
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
      setError(err instanceof Error ? err.message : "Failed to load.");
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
        setError(json.error || "Could not start payment.");
        setErrorAr(json.errorAr);
        return;
      }
      setActiveOrder(json.order);
      setInstructions(json.instructions);
      setPrice(json.price || null);
      if (json.paymentMethod && isPaymentMethod(json.paymentMethod)) {
        setPaymentMethod(json.paymentMethod);
      }
      setMessage(json.messageAr || json.message);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
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
        setError(json.error || "Could not mark transfer.");
        setErrorAr(json.errorAr);
        return;
      }
      if (json.order) setActiveOrder(json.order);
      setMessage(json.messageAr || json.message);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mark failed.");
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
        setError(json.error || "Confirm failed.");
        setErrorAr(json.errorAr);
        return;
      }
      setMessage(json.messageAr || json.message);
      if (activeOrder?.id === orderId) setActiveOrder(json.order || null);
      await loadSessionAndOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed.");
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
        <p className="eyebrow">Prof. Munzer Haddara · الأستاذ منذر حداره</p>
        <p dir="rtl">
          اختر منطقتك حسب المنهج. لبنان: Whish إلى <strong>96170772968</strong> باسم{" "}
          <strong>منذر أحمد حداره</strong>. الخليج والدولي: Western Union أو OMT أيضاً.
        </p>
        <p className="muted">
          Prices follow your curriculum region ({curriculum.labelEn} / {curriculum.labelAr}). Lebanon defaults to
          Whish (<strong>96170772968</strong>). GCC, International, and US Admissions can also use Western Union or OMT.
          Cards show USD bands; checkout charges the band midpoint (<code>defaultChargeUSD</code>).
          {contactPhone ? ` Support: ${contactPhone} (not payment).` : ""}
        </p>
        {contactNote ? <p className="muted">{contactNote}</p> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">Region · المنطقة</p>
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
                {pack.selectorAr} / {pack.selectorEn}
              </button>
            );
          })}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Linked to curriculum switcher · مرتبط بمبدّل المنهج ({curriculum.shortEn} / {curriculum.shortAr})
        </p>
        {pricing.notesAr ? (
          <p dir="rtl" style={{ marginTop: 8 }}>
            {pricing.notesAr}
          </p>
        ) : null}
        {pricing.notesEn ? <p className="muted">{pricing.notesEn}</p> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">Payment method · طريقة الدفع</p>
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
                {label.ar}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? <SkeletonBlock lines={4} label="Loading subscribe" /> : null}
      {busy ? <SkeletonBlock lines={2} label="Updating payment" /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {message ? <p className="success">{message}</p> : null}

      {!authenticated ? (
        <p className="muted">
          <Link href="/login?next=%2Fsubscribe">Sign in</Link> to start a subscription payment.
        </p>
      ) : null}

      {activeOrder && instructions && activeOrder.status !== "paid" ? (
        <ManualTransferCheckout
          method={activeMethod}
          amount={activeOrder.amount}
          currency={activeOrder.currency || "USD"}
          display={price?.display}
          displayAr={price?.displayAr}
          title={`${activeOrder.planName} · ${activeOrder.period}`}
          titleAr={`${activeOrder.planNameAr} · ${activeOrder.period === "monthly" ? "شهري" : "فصل"}`}
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
          <h3>بانتظار التحويل (اشتراكات) / Pending subscription transfers</h3>
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
                  <strong>{order.planNameAr}</strong> · {order.studentName} · ${order.amount} · {order.period} ·{" "}
                  {label.ar}
                  {regionLabel ? ` · ${regionLabel.labelAr}` : ""}
                  {order.status === "transfer_claimed" || order.studentMarkedPaidAt
                    ? " · student marked transferred"
                    : " · pending"}
                </p>
                <p className="muted">Order: {order.id}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {!staff && order.status !== "transfer_claimed" ? (
                    <button
                      className="btn dark"
                      type="button"
                      disabled={busy}
                      onClick={() => void markTransferred(order.id)}
                    >
                      لقد حوّلت / I&apos;ve transferred
                    </button>
                  ) : null}
                  {staff ? (
                    <button
                      className="btn dark"
                      type="button"
                      disabled={busy}
                      onClick={() => void teacherConfirm(order.id)}
                    >
                      تأكيد الدفع وتفعيل الباقة / Confirm &amp; activate
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
            {(plan.badgeAr || plan.badgeEn) ? (
              <span className="badge">{plan.badgeAr || plan.badgeEn}</span>
            ) : null}
            <span className="badge">{plan.nameEn}</span>
            <h2>{plan.nameAr}</h2>
            <p style={{ fontSize: 28, margin: "8px 0" }}>
              {planShowsPriceBand(plan)
                ? formatUsdBand(plan.usdMonthlyMin, plan.usdMonthlyMax)
                : `$${plan.defaultChargeUSD}`}
              <span className="muted"> / month</span>
            </p>
            {planShowsPriceBand(plan) ? (
              <p className="muted">
                Checkout default · ${plan.defaultChargeUSD}/mo (band midpoint)
              </p>
            ) : null}
            {plan.sarMonthlyMin != null && plan.sarMonthlyMax != null ? (
              <p className="muted">
                ≈ {plan.sarMonthlyMin === plan.sarMonthlyMax
                  ? `${plan.sarMonthlyMin}`
                  : `${plan.sarMonthlyMin}–${plan.sarMonthlyMax}`}{" "}
                SAR / month
              </p>
            ) : null}
            <p className="muted">
              ${plan.usdTerm} per term
              {planShowsPriceBand(plan) ? " (at default)" : ""} · {formatRegionalPrice(plan, "monthly")}
            </p>
            <ul dir="rtl" style={{ paddingInlineStart: 18 }}>
              {plan.featuresAr.map((feature) => (
                <li key={`ar-${plan.id}-${feature}`}>{feature}</li>
              ))}
            </ul>
            <ul className="muted" style={{ paddingInlineStart: 18 }}>
              {plan.featuresEn.map((feature) => (
                <li key={`en-${plan.id}-${feature}`}>{feature}</li>
              ))}
            </ul>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              <button
                className="btn dark"
                type="button"
                disabled={busy || !authenticated}
                onClick={() => void startPayment(plan, "monthly")}
              >
                ادفع شهري · ${plan.defaultChargeUSD}
              </button>
              <button
                className="btn dark"
                type="button"
                disabled={busy || !authenticated}
                onClick={() => void startPayment(plan, "term")}
              >
                ادفع فصل · ${plan.usdTerm}
              </button>
            </div>
            {!authenticated ? (
              <p className="muted" style={{ marginTop: 8 }}>
                <Link href="/login?next=%2Fsubscribe">سجّل الدخول</Link> لبدء الدفع.
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>ساعة تدريس خاصة · Private tutoring hour</h3>
        <p dir="rtl">
          <strong>{formatPrivateHourBand(pricing)}</strong> / ساعة — مع الأستاذ منذر حداره ({pricing.labelAr})
          {pricing.privateTutoringHourMinUsd !== pricing.privateTutoringHourMaxUsd
            ? ` · الافتراضي $${pricing.privateTutoringHourUsd}`
            : ""}
        </p>
        <p className="muted">
          <strong>{formatPrivateHourBand(pricing)}</strong> / hour with Prof. Munzer Haddara ({pricing.labelEn})
          {pricing.privateTutoringHourMinUsd !== pricing.privateTutoringHourMaxUsd
            ? ` · default $${pricing.privateTutoringHourUsd}`
            : ""}
          . Book from <Link href="/live">/live</Link> after agreeing the slot.
        </p>
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <Link className="btn" href="/redeem">
          تفعيل بطاقة كشط
        </Link>
        <Link className="btn" href="/live">
          حجز حصة مباشرة
        </Link>
        <Link className="btn" href="/classroom">
          Start a classroom video
        </Link>
      </div>
    </div>
  );
}
