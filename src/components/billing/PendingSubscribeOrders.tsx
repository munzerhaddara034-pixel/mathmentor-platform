"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";
import { rich } from "@/lib/i18n/rich";

type Order = {
  id: string;
  planName: string;
  planNameAr: string;
  period: string;
  amount: number;
  status: string;
  studentName: string;
  studentMarkedPaidAt?: string;
  paymentMethod?: string;
  pricingRegion?: string;
};

/** Teacher-facing pending Whish subscription orders (embed on /live). */
export function PendingSubscribeOrders({ staff }: { staff: boolean }) {
  const { locale } = useI18n();
  const t = billingMessages[locale].pendingOrders;
  const p = billingMessages[locale].plans;
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const load = useCallback(async () => {
    if (!staff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/billing/orders?pending=1", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { orders?: Order[]; error?: string };
      if (!res.ok) {
        setError(json.error || t.loadFailed);
        return;
      }
      setOrders(json.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [staff]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm(orderId: string) {
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
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
        message?: string;
        messageAr?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error || p.confirmFailed);
        return;
      }
      setMessage((locale === "ar" ? json.messageAr || json.message : json.message || json.messageAr) || p.confirmed);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : p.confirmFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!staff) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>{t.title}</h3>
      <p className="muted">{rich(t.lead, { link: <a href="/subscribe">/subscribe</a> })}</p>
      {loading ? <SkeletonBlock lines={2} label={t.loading} /> : null}
      {busy ? <SkeletonBlock lines={1} label={t.confirming} /> : null}
      <ApiErrorBanner error={error} />
      {message ? <p className="success">{message}</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : null}
      {orders.map((order) => (
        <div key={order.id} style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <p>
            <strong>{locale === "ar" ? order.planNameAr : order.planName}</strong> · {order.studentName} · $
            {order.amount} · {order.period === "monthly" ? p.monthly : order.period === "term" ? p.term : order.period}
                {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
                {order.pricingRegion ? ` · ${order.pricingRegion}` : ""}
            {order.status === "transfer_claimed" || order.studentMarkedPaidAt
              ? p.studentMarked
              : t.awaiting}
          </p>
          <p className="muted">{fmt(p.order, { id: order.id })}</p>
          <button className="btn dark" type="button" disabled={busy} onClick={() => void confirm(order.id)}>
            {p.confirm}
          </button>
        </div>
      ))}
    </div>
  );
}
