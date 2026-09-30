"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { PRICING_STUDY } from "@/lib/b2b/pricingStudy";
import { useI18n } from "@/components/i18n/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { rich } from "@/lib/i18n/rich";
import { b2bMessages } from "@/lib/i18n/ns/b2b";

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

/** Preset labels are stored on the payment record, so they stay bilingual (ar / en) like the plan data. */
const PLAN_PRESETS = [
  ...PRICING_STUDY.map((row) => ({
    label: `${row.nameAr} / ${row.nameEn}`,
    nameAr: row.nameAr,
    nameEn: row.nameEn,
    amount:
      row.usd.monthlyMin ??
      row.usd.perStudentMonthlyMin ??
      row.usd.hourlyMin ??
      row.usd.schoolYear ??
      10,
  })),
  { label: "مخصص / Custom", nameAr: "", nameEn: "", amount: 0 },
];

type WalletProps = { phone: string; nameAr: string };

export function WhishOpsPanel({ wallet }: { wallet: WalletProps }) {
  const { locale } = useI18n();
  const t = b2bMessages[locale].whish;
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
        setError(json.error || t.loadFailed);
        return;
      }
      setPayments(json.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.loadFailed);
    } finally {
      setListLoading(false);
    }
  }, [t]);

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
        setError(json.error || t.confirmFailed);
        setErrorAr(json.errorAr);
        return;
      }
      setMessage((locale === "ar" ? json.messageAr || json.message : json.message || json.messageAr) || t.saved);
      setReferenceId("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.confirmFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card b2b-section mm-mobile-stack no-print" aria-labelledby="b2b-whish-title">
      <h2 id="b2b-whish-title">{t.title}</h2>
      <p className="muted">
        {rich(t.lead, {
          phone: <strong dir="ltr">{wallet.phone}</strong>,
          name: <strong dir="auto">{locale === "ar" ? wallet.nameAr : "Munzer Ahmad Haddara"}</strong>,
        })}
      </p>

      <div className="b2b-form-grid">
        <label>
          {t.reference}
          <input
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            placeholder={t.referencePlaceholder}
            dir="ltr"
          />
        </label>
        <label>
          {t.plan}
          <select value={planIndex} onChange={(e) => onPlanChange(Number(e.target.value))}>
            {PLAN_PRESETS.map((preset, index) => (
              <option key={preset.label} value={index}>
                {preset.nameEn ? (locale === "ar" ? preset.nameAr : preset.nameEn) : t.custom}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.amount}
          <input
            type="number"
            min={1}
            step={0.01}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Number(e.target.value) || 0)}
          />
        </label>
        <label>
          {t.note}
          <input value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
        </label>
        {planIndex === PLAN_PRESETS.length - 1 ? (
          <label>
            {t.customLabel}
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
            {t.confirm}
          </button>
        </div>
      </div>

      {loading ? <SkeletonBlock lines={2} label={t.saving} /> : null}
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}

      <h3 style={{ marginTop: 20 }}>{t.recent}</h3>
      {listLoading ? <SkeletonBlock lines={3} label={t.loadingList} /> : null}
      {!listLoading && payments.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : null}
      <ul className="b2b-payment-list">
        {payments.map((payment) => (
          <li key={payment.id}>
            <strong dir="auto">{payment.planLabel}</strong> · ${payment.amountUsd} · {t.ref}{" "}
            <code>{payment.referenceId}</code>
            <br />
            <span className="muted">
              {payment.status} · {payment.recordedByName} ·{" "}
              {new Date(payment.createdAt).toLocaleString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut" })} {t.tz}
              {payment.note ? ` · ${payment.note}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
