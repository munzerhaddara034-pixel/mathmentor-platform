"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { PRICING_STUDY } from "@/lib/b2b/pricingStudy";

type PaymentRow = {
  id: string;
  referenceId: string;
  note?: string;
  planLabel: string;
  amountUsd: number;
  walletPhone: string;
  walletNameAr: string;
  status: string;
  createdAt: string;
  recordedByName: string;
};

const PLAN_PRESETS = [
  ...PRICING_STUDY.map((row) => ({
    label: `${row.nameAr} / ${row.nameEn}`,
    amount:
      row.usd.monthlyMin ??
      row.usd.perStudentMonthlyMin ??
      row.usd.hourlyMin ??
      row.usd.schoolYear ??
      10,
  })),
  { label: "مخصص / Custom", amount: 0 },
];

type WalletProps = { phone: string; nameAr: string };

export function WhishOpsPanel({ wallet }: { wallet: WalletProps }) {
  const [referenceId, setReferenceId] = useState("");
  const [note, setNote] = useState("");
  const [planIndex, setPlanIndex] = useState(0);
  const [amountUsd, setAmountUsd] = useState(PLAN_PRESETS[0].amount);
  const [planLabel, setPlanLabel] = useState(PLAN_PRESETS[0].label);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [errorAr, setErrorAr] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/admin/b2b/whish-confirm", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        payments?: PaymentRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(json.error || "Failed to load payments.");
        return;
      }
      setPayments(json.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onPlanChange(index: number) {
    setPlanIndex(index);
    const preset = PLAN_PRESETS[index];
    setPlanLabel(preset.label);
    if (preset.amount > 0) setAmountUsd(preset.amount);
  }

  async function confirm() {
    setLoading(true);
    setError(undefined);
    setErrorAr(undefined);
    setMessage(undefined);
    try {
      const res = await fetch("/api/admin/b2b/whish-confirm", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceId,
          note: note || undefined,
          planLabel,
          amountUsd,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errorAr?: string;
        messageAr?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error || "Confirm failed.");
        setErrorAr(json.errorAr);
        return;
      }
      setMessage(json.messageAr || json.message || "Saved.");
      setReferenceId("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card b2b-section mm-mobile-stack no-print" aria-labelledby="b2b-whish-title">
      <h2 id="b2b-whish-title">عمليات Whish / Whish payment ops</h2>
      <p className="muted" dir="rtl" lang="ar">
        المحفظة: <strong dir="ltr">{wallet.phone}</strong> باسم <strong>{wallet.nameAr}</strong>. الدفع عبر Whish فقط —
        بعد التأكيد يُحفظ السجل ويُشعر المشرف لتفعيل الحساب وإصدار بطاقة الاشتراك.
      </p>

      <div className="b2b-form-grid">
        <label>
          Reference ID / رقم المرجع
          <input
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder="Whish reference"
            dir="ltr"
          />
        </label>
        <label>
          الباقة / Plan
          <select value={planIndex} onChange={(e) => onPlanChange(Number(e.target.value))}>
            {PLAN_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          المبلغ USD / Amount
          <input
            type="number"
            min={1}
            step={0.01}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          ملاحظة اختيارية / Optional note
          <input value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
        </label>
        {planIndex === PLAN_PRESETS.length - 1 ? (
          <label>
            اسم الباقة المخصص / Custom plan label
            <input value={planLabel} onChange={(e) => setPlanLabel(e.target.value)} dir="auto" />
          </label>
        ) : null}
        <div className="row" style={{ alignItems: "end" }}>
          <button
            type="button"
            className="btn"
            disabled={loading || !referenceId.trim() || !(amountUsd > 0)}
            onClick={() => void confirm()}
          >
            تأكيد التحويل / Confirm
          </button>
        </div>
      </div>

      {loading ? <SkeletonBlock lines={2} label="Saving Whish payment" /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}

      <h3 style={{ marginTop: 20 }}>آخر الدفعات / Recent</h3>
      {listLoading ? <SkeletonBlock lines={3} label="Loading payments" /> : null}
      {!listLoading && payments.length === 0 ? (
        <p className="muted">No Whish ops payments yet.</p>
      ) : null}
      <ul className="b2b-payment-list">
        {payments.map((payment) => (
          <li key={payment.id}>
            <strong>{payment.planLabel}</strong> · ${payment.amountUsd} · ref{" "}
            <code>{payment.referenceId}</code>
            <br />
            <span className="muted">
              {payment.status} · {payment.recordedByName} · {new Date(payment.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}{" "}
              Asia/Beirut
              {payment.note ? ` · ${payment.note}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
