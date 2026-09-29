"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";

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
        setError(json.error || "Failed to load subscription orders.");
        return;
      }
      setOrders(json.orders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
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
        setError(json.error || "Confirm failed.");
        return;
      }
      setMessage(json.messageAr || json.message || "Confirmed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!staff) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>اشتراكات Whish بانتظار التأكيد / Pending Whish subscriptions</h3>
      <p className="muted">
        Confirm after you see the Whish transfer. Activates plan + live credits. Full list also on{" "}
        <a href="/subscribe">/subscribe</a>.
      </p>
      {loading ? <SkeletonBlock lines={2} label="Loading subscription orders" /> : null}
      {busy ? <SkeletonBlock lines={1} label="Confirming" /> : null}
      <ApiErrorBanner error={error} />
      {message ? <p className="success">{message}</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="muted">No pending subscription orders.</p>
      ) : null}
      {orders.map((order) => (
        <div key={order.id} style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <p>
            <strong>{order.planNameAr}</strong> · {order.studentName} · ${order.amount} · {order.period}
                {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
                {order.pricingRegion ? ` · ${order.pricingRegion}` : ""}
            {order.status === "transfer_claimed" || order.studentMarkedPaidAt
              ? " · student marked transferred"
              : " · awaiting transfer"}
          </p>
          <p className="muted">Order: {order.id}</p>
          <button className="btn dark" type="button" disabled={busy} onClick={() => void confirm(order.id)}>
            تأكيد الدفع وتفعيل / Confirm &amp; activate
          </button>
        </div>
      ))}
    </div>
  );
}
