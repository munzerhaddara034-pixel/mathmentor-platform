"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { paymentsMessages } from "@/lib/i18n/ns/payments";
import type { MethodSettings, PaymentSettings } from "@/lib/payments/config";
import type { AdminPaymentRow, PaymentMethodId, PaymentStatus } from "@/lib/payments/types";

type Row = AdminPaymentRow & { currentAiExpiresAt: string | null };
type ApiBody = { ok?: boolean; error?: string; errorAr?: string; message?: string; messageAr?: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function day(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "—";
}

/** Same default the server uses: 30 / 90 days, extended from a still-active expiry. */
function defaultExpiry(row: Row): string {
  const days = row.period === "term" ? 90 : 30;
  const current = row.currentAiExpiresAt ? Date.parse(row.currentAiExpiresAt) : NaN;
  const base = Number.isFinite(current) && current > Date.now() ? current : Date.now();
  return new Date(base + days * DAY_MS).toISOString().slice(0, 10);
}

async function postJson(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; body: ApiBody }> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const parsed = (await response.json().catch(() => ({}))) as ApiBody;
    return { ok: response.ok && parsed.ok !== false, body: parsed };
  } catch {
    return { ok: false, body: {} };
  }
}

export function PaymentsReview() {
  const { locale } = useI18n();
  const t = useNs(paymentsMessages).admin;
  const isAr = locale === "ar";
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState<Row | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [expiryDefault, setExpiryDefault] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    setLoadError("");
    void fetch(`/api/admin/payments?status=${status}`, { credentials: "same-origin" })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as ApiBody & { payments?: Row[]; pendingCount?: number };
        if (!response.ok || !body.ok) throw new Error((isAr ? body.errorAr : body.error) || t.loadFailed);
        setRows(body.payments ?? []);
        setPendingCount(body.pendingCount ?? 0);
      })
      .catch((error: unknown) => {
        setRows([]);
        setLoadError(error instanceof Error ? error.message : t.loadFailed);
      });
  }, [status, isAr, t.loadFailed]);
  useEffect(load, [load]);

  const finish = (result: { ok: boolean; body: ApiBody }) => {
    setBusy(false);
    const text = (isAr ? result.body.messageAr || result.body.errorAr : result.body.message || result.body.error) || (result.ok ? t.done : t.loadFailed);
    setMessage(text);
    if (result.ok) {
      setConfirming(null);
      setRejecting(null);
      setNote("");
      load();
    }
  };

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    // Unchanged date → let the server compute the exact default (30 / 90 days from now or from the active expiry).
    const iso = expiresAt && expiresAt !== expiryDefault ? new Date(`${expiresAt}T23:59:59+03:00`).toISOString() : undefined;
    finish(await postJson(`/api/admin/payments/${encodeURIComponent(confirming.id)}/confirm`, { expiresAt: iso, note: note.trim() || undefined }));
  };

  const reject = async () => {
    if (!rejecting || !note.trim()) return;
    setBusy(true);
    finish(await postJson(`/api/admin/payments/${encodeURIComponent(rejecting.id)}/reject`, { note: note.trim() }));
  };

  const tabs: Array<[PaymentStatus, string]> = [
    ["pending", `${t.tabPending} (${pendingCount})`],
    ["confirmed", t.tabConfirmed],
    ["rejected", t.tabRejected],
  ];

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      <div className="row" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={status === id} className={status === id ? "btn dark" : "btn"} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
      {message ? (
        <p className="success" role="status">
          {message}
        </p>
      ) : null}
      {loadError ? (
        <p className="studio-teacher-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <section className="card" style={{ marginBlockStart: 16, overflowX: "auto" }}>
        {rows === null ? (
          <p className="muted" aria-busy="true">
            {t.loading}…
          </p>
        ) : rows.length === 0 ? (
          <p className="muted">{t.none}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.student}</th>
                <th>{t.plan}</th>
                <th>{t.amount}</th>
                <th>{t.method}</th>
                <th>{t.reference}</th>
                <th>{t.transferDate}</th>
                <th>{t.receipt}</th>
                <th>{status === "pending" ? t.submitted : t.reviewed}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.payerName}</strong>
                    <br />
                    <span className="muted" dir="ltr">
                      {row.payerEmail ?? ""} {row.payerPhone ?? ""}
                    </span>
                    <br />
                    <span className="muted">{fmt(t.currentExpiry, { date: day(row.currentAiExpiresAt) })}</span>
                  </td>
                  <td>
                    {row.plan} · {row.period}
                  </td>
                  <td dir="ltr">
                    ${row.amount} <span className="muted">({fmt(t.expected, { amount: `$${row.expectedAmountUsd}` })})</span>
                    {row.amountMismatch ? (
                      <>
                        <br />
                        <strong className="studio-teacher-error">{t.mismatch}</strong>
                      </>
                    ) : null}
                  </td>
                  <td>{row.method === "whish" ? "Whish" : "OMT"}</td>
                  <td dir="ltr">{row.reference}</td>
                  <td dir="ltr">{row.transferDate}</td>
                  <td>
                    {row.receiptPurged ? (
                      <span className="muted">{t.receiptPurged}</span>
                    ) : row.hasReceipt ? (
                      <a href={`/api/payments/${encodeURIComponent(row.id)}/receipt`} target="_blank" rel="noopener noreferrer">
                        {t.openReceipt}
                      </a>
                    ) : (
                      <span className="muted">{t.noReceipt}</span>
                    )}
                    {row.duplicateReceiptCount > 0 ? (
                      <>
                        <br />
                        <strong className="studio-teacher-error">{fmt(t.duplicateReceipt, { count: row.duplicateReceiptCount })}</strong>
                      </>
                    ) : null}
                  </td>
                  <td dir="ltr">
                    {status === "pending" ? day(row.submittedAt) : day(row.reviewedAt)}
                    {row.status === "confirmed" ? (
                      <>
                        <br />
                        <span className="muted">{fmt(t.periodEnd, { date: day(row.periodEnd) })}</span>
                      </>
                    ) : null}
                    {row.note ? (
                      <>
                        <br />
                        <span className="muted">
                          {t.note}: {row.note}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {row.status === "pending" ? (
                      <div className="row">
                        <button
                          className="btn dark"
                          type="button"
                          onClick={() => {
                            setNote("");
                            setExpiresAt(defaultExpiry(row));
                            setExpiryDefault(defaultExpiry(row));
                            setConfirming(row);
                          }}
                        >
                          {t.confirm}
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => {
                            setNote("");
                            setRejecting(row);
                          }}
                        >
                          {t.reject}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <PaymentSettingsPanel />

      {confirming ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.confirmTitle}>
          <div className="card modal-card">
            <h2>{t.confirmTitle}</h2>
            <p>
              <strong>{confirming.payerName}</strong> · {confirming.plan} · <span dir="ltr">${confirming.amount}</span> ·{" "}
              <span dir="ltr">{confirming.reference}</span>
            </p>
            <label>
              {t.expiresAt}
              <input type="date" dir="ltr" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <p className="muted">{t.expiresHint}</p>
            <label>
              {t.optionalNote}
              <input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="row">
              <button className="btn dark" type="button" disabled={busy} onClick={() => void confirm()}>
                {busy ? `${t.working}…` : t.confirm}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => setConfirming(null)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejecting ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.rejectTitle}>
          <div className="card modal-card">
            <h2>{t.rejectTitle}</h2>
            <p>
              <strong>{rejecting.payerName}</strong> · <span dir="ltr">{rejecting.reference}</span>
            </p>
            <label>
              {t.rejectNote}
              <textarea required maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="row">
              <button className="btn dark" type="button" disabled={busy || !note.trim()} onClick={() => void reject()}>
                {busy ? `${t.working}…` : t.reject}
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => setRejecting(null)}>
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function PaymentSettingsPanel() {
  const t = useNs(paymentsMessages).admin;
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/payments/settings", { credentials: "same-origin" })
      .then((response) => response.json() as Promise<{ ok?: boolean; effective?: PaymentSettings }>)
      .then((body) => setSettings(body.effective ?? null))
      .catch(() => setStatus(t.loadFailed));
  }, [t.loadFailed]);

  if (!settings) return status ? <p className="studio-teacher-error">{status}</p> : null;

  const update = (id: PaymentMethodId, patch: Partial<MethodSettings>) => setSettings({ ...settings, [id]: { ...settings[id], ...patch } });

  const save = async () => {
    setBusy(true);
    setStatus("");
    const result = await postJson("/api/admin/payments/settings", settings, "PUT");
    setBusy(false);
    setStatus(result.ok ? t.saved : result.body.error || t.loadFailed);
  };

  return (
    <section className="card" style={{ marginBlockStart: 20 }}>
      <h2>{t.settingsTitle}</h2>
      <p className="muted">{t.settingsLead}</p>
      <div className="grid two">
        {(Object.keys(settings) as PaymentMethodId[]).map((id) => (
          <fieldset key={id}>
            <legend>{id === "whish" ? "Whish Money" : "OMT"}</legend>
            <label>
              <input type="checkbox" checked={settings[id].enabled} onChange={(event) => update(id, { enabled: event.target.checked })} /> {t.enabled}
            </label>
            <label>
              {t.number}
              <input dir="ltr" maxLength={20} value={settings[id].number} onChange={(event) => update(id, { number: event.target.value })} />
            </label>
            <label>
              {t.nameAr}
              <input dir="rtl" maxLength={80} value={settings[id].nameAr} onChange={(event) => update(id, { nameAr: event.target.value })} />
            </label>
            <label>
              {t.nameEn}
              <input maxLength={80} value={settings[id].nameEn} onChange={(event) => update(id, { nameEn: event.target.value })} />
            </label>
          </fieldset>
        ))}
      </div>
      <button className="btn dark" type="button" disabled={busy} onClick={() => void save()}>
        {busy ? `${t.working}…` : t.saveSettings}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}
