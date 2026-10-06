"use client";

import { useCallback, useEffect, useState } from "react";
import { LocationGate, RegionNotice } from "@/components/billing/LocationGate";
import { useGeoRegion } from "@/components/billing/useGeoRegion";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { paymentsMessages } from "@/lib/i18n/ns/payments";
import type { PaymentSettings } from "@/lib/payments/config";
import type { PlanOption } from "@/lib/payments/service";
import type { PaymentMethodId, PaymentPeriod, PaymentRecord } from "@/lib/payments/types";

type Props = {
  canSubmit: boolean;
  blockedReason: "parent" | "role" | "unavailable" | null;
  settings: PaymentSettings;
  plans: PlanOption[];
  prefill: { name: string; email: string; phone: string };
};

const MAX_EDGE = 1600;
const DOWNSCALE_ABOVE_BYTES = 1.5 * 1024 * 1024;

function beirutToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Shrink big phone photos on the device (≤1600 px JPEG). Falls back to the original file. */
async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= DOWNSCALE_ABOVE_BYTES) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function PaymentClaimForm({ canSubmit, blockedReason, settings, plans, prefill }: Props) {
  const { locale } = useI18n();
  const t = useNs(paymentsMessages).form;
  const isAr = locale === "ar";
  const methods = (Object.keys(settings) as PaymentMethodId[]).filter((id) => settings[id].enabled);
  // Region-locked: no manual region choice. The server resolves it (location claim + IP country + phone)
  // and recomputes the price at submit; this view only mirrors that decision.
  const geo = useGeoRegion();
  const region: string = geo.state.status === "ready" ? geo.state.region : "";
  const regionPlans = plans.filter((plan) => plan.region === region);
  const [planId, setPlanId] = useState<string>(regionPlans[0]?.planId ?? "");
  const [period, setPeriod] = useState<PaymentPeriod>("monthly");
  const selected = regionPlans.find((plan) => plan.planId === planId) ?? regionPlans[0];
  const due = selected ? (period === "monthly" ? selected.usdMonthly : selected.usdTerm) : 0;

  const [name, setName] = useState(prefill.name);
  const [email, setEmail] = useState(prefill.email);
  const [phone, setPhone] = useState(prefill.phone);
  const [amount, setAmount] = useState(String(due || ""));
  const [method, setMethod] = useState<PaymentMethodId | "">(methods[0] ?? "");
  const [reference, setReference] = useState("");
  const [transferDate, setTransferDate] = useState(beirutToday());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [history, setHistory] = useState<PaymentRecord[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => setAmount(due ? String(due) : ""), [due]);
  useEffect(() => {
    if (!regionPlans.some((plan) => plan.planId === planId)) setPlanId(regionPlans[0]?.planId ?? "");
  }, [region]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(() => {
    void fetch("/api/payments", { credentials: "same-origin" })
      .then((response) => (response.ok ? (response.json() as Promise<{ payments: PaymentRecord[] }>) : { payments: [] }))
      .then((body) => setHistory(body.payments ?? []))
      .catch(() => setHistory([]));
  }, []);
  useEffect(loadHistory, [loadHistory]);

  const methodInfo = method ? settings[method] : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!method || !selected) return;
    setBusy(true);
    setError("");
    setSuccess("");
    const form = new FormData();
    form.set("payerName", name);
    if (email.trim()) form.set("payerEmail", email.trim());
    if (phone.trim()) form.set("payerPhone", phone.trim());
    if (geo.state.status === "ready") form.set("locationRegion", geo.state.locationRegion);
    form.set("plan", selected.planId);
    form.set("period", period);
    form.set("amount", amount);
    form.set("currency", "USD");
    form.set("method", method);
    form.set("reference", reference);
    form.set("transferDate", transferDate);
    if (file) {
      const blob = await downscale(file);
      form.set("receipt", blob, blob === file ? file.name : "receipt.jpg");
    }
    try {
      const response = await fetch("/api/payments", { method: "POST", body: form, credentials: "same-origin" });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; errorAr?: string; message?: string; messageAr?: string };
      if (!response.ok || !body.ok) {
        setError((isAr ? body.errorAr || body.error : body.error || body.errorAr) || t.errorGeneric);
      } else {
        setSuccess((isAr ? body.messageAr : body.message) || t.success);
        setReference("");
        setFile(null);
        loadHistory();
      }
    } catch {
      setError(t.errorGeneric);
    }
    setBusy(false);
  };

  const statusText = (payment: PaymentRecord) => {
    if (payment.status === "confirmed") return fmt(t.statusConfirmed, { date: (payment.periodEnd ?? "").slice(0, 10) });
    if (payment.status === "rejected") return fmt(t.statusRejected, { note: payment.note ?? "" });
    return t.statusPending;
  };

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>

      {!canSubmit ? (
        <p className="studio-teacher-error" role="status">
          {blockedReason === "unavailable" ? t.notAvailable : t.parentsBlocked}
        </p>
      ) : methods.length === 0 ? (
        <p className="studio-teacher-error" role="status">
          {t.noMethods}
        </p>
      ) : geo.state.status !== "ready" ? (
        <LocationGate state={geo.state} onEnable={geo.request} />
      ) : (
        <div className="grid two">
          <section className="card">
            <h2>{t.instructionsTitle}</h2>
            <p>
              <strong>{fmt(t.instructionsLead, { amount: `$${due} USD` })}</strong>
            </p>
            {methods.map((id) => (
              <div key={id} style={{ marginBlockEnd: 12 }}>
                <p className="eyebrow">{id === "whish" ? "Whish Money" : "OMT"}</p>
                <p>
                  {t.number}: <strong dir="ltr">{settings[id].number}</strong>{" "}
                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(settings[id].number).then(() => setCopied(true));
                    }}
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </p>
                <p>
                  {t.beneficiary}: <strong>{isAr ? settings[id].nameAr : settings[id].nameEn}</strong>
                  {isAr ? null : <span className="muted"> ({settings[id].nameAr})</span>}
                </p>
              </div>
            ))}
            <p className="muted">{t.keepReceipt}</p>
            <p className="muted">{t.activationNote}</p>
          </section>

          <form className="card" onSubmit={(event) => void submit(event)}>
            <RegionNotice region={geo.state.region} sources={geo.state.sources} mismatch={geo.state.mismatch} />
            <p>
              {t.region}: <strong>{t.regions[geo.state.region as keyof typeof t.regions] ?? geo.state.region}</strong>
            </p>
            <label>
              {t.plan}
              <select value={selected?.planId ?? ""} onChange={(event) => setPlanId(event.target.value)}>
                {regionPlans.map((plan) => (
                  <option key={plan.planId} value={plan.planId}>
                    {isAr ? plan.nameAr : plan.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.period}
              <select value={period} onChange={(event) => setPeriod(event.target.value as PaymentPeriod)}>
                <option value="monthly">{t.monthly}</option>
                <option value="term">{t.term}</option>
              </select>
            </label>
            <p>
              <strong>{fmt(t.amountDue, { amount: `$${due} USD` })}</strong>
            </p>
            <label>
              {t.name}
              <input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              {t.email}
              <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              {t.phone}
              <input type="tel" dir="ltr" maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <p className="muted">{t.contactHint}</p>
            <label>
              {t.amount}
              <input required type="number" min="0.01" step="0.01" dir="ltr" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label>
              {t.method}
              <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethodId)}>
                {methods.map((id) => (
                  <option key={id} value={id}>
                    {id === "whish" ? "Whish Money" : "OMT"}
                  </option>
                ))}
              </select>
            </label>
            {methodInfo ? (
              <p className="muted">
                {t.number}: <span dir="ltr">{methodInfo.number}</span> · {isAr ? methodInfo.nameAr : methodInfo.nameEn}
              </p>
            ) : null}
            <label>
              {t.reference}
              <input required dir="ltr" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
            <p className="muted">{t.referenceHint}</p>
            <label>
              {t.transferDate}
              <input required type="date" dir="ltr" max={beirutToday()} value={transferDate} onChange={(event) => setTransferDate(event.target.value)} />
            </label>
            <label>
              {t.receipt}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
            <p className="muted">{t.receiptHint}</p>
            <button className="btn dark" type="submit" disabled={busy || !selected || !method}>
              {busy ? `${t.submitting}…` : t.submit}
            </button>
            {error ? (
              <p className="studio-teacher-error" role="alert">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="success" role="status">
                {success}
              </p>
            ) : null}
          </form>
        </div>
      )}

      <section className="card" style={{ marginBlockStart: 20, overflowX: "auto" }}>
        <h2>{t.history}</h2>
        {history === null ? (
          <p className="muted" aria-busy="true">
            {t.loading}…
          </p>
        ) : history.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <table className="data-table">
            <tbody>
              {history.map((payment) => (
                <tr key={payment.id}>
                  <td dir="ltr">{payment.transferDate}</td>
                  <td>{payment.method === "whish" ? "Whish" : "OMT"}</td>
                  <td dir="ltr">{payment.reference}</td>
                  <td dir="ltr">${payment.amount}</td>
                  <td>{statusText(payment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
