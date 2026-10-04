"use client";

import { subscriptionLabel } from "@/lib/auth/tiers";
import type { LedgerEntry } from "@/lib/billing/store";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";

type WalletPayload = {
  name: string;
  phone: string;
  email: string;
  subscriptionType: "AI_TIER" | "LIVE_TIER" | "BOTH" | "EXPIRED" | null;
  aiStatus: "none" | "expired" | "active";
  aiExpiresAt: string | null;
  liveCredits: number;
  ledger: LedgerEntry[];
  devices?: {
    id: string;
    deviceClass: string;
    createdAt: string;
    createdAtBeirut?: string;
    deviceName?: string;
    deviceNameAr?: string;
    current: boolean;
  }[];
  sharingExempt?: boolean;
};

export default function WalletPage() {
  const { locale, m } = useI18n();
  const t = useNs(accountMessages).wallet;
  const [data, setData] = useState<WalletPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoadError(false);
    void fetch("/api/billing/wallet", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<WalletPayload>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  };

  useEffect(() => {
    load();
  }, []);

  const redeem = async () => {
    setBusy(true);
    setMessage("");
    let payload: { ok?: boolean; message?: string; messageAr?: string; error?: string } = {};
    try {
      const response = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = { ok: false, error: t.loadFailed };
    }
    setMessage((locale === "ar" ? payload.messageAr || payload.message : payload.message || payload.messageAr) || payload.error || "");
    setBusy(false);
    if (payload.ok) {
      setOpen(false);
      setCode("");
      load();
    }
  };

  if (loadError && !data) {
    return (
      <main className="shell">
        <p className="studio-teacher-error" role="alert">
          {t.loadFailed}
        </p>
      </main>
    );
  }
  if (!data) return <main className="shell" aria-busy="true">{t.loading}</main>;
  const label = subscriptionLabel(data.subscriptionType);
  const expires = data.aiExpiresAt
    ? new Date(data.aiExpiresAt).toLocaleDateString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut" })
    : "—";

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <div className="grid two">
        <article className="card">
          <h2>{t.aiTitle}</h2>
          <p style={{ fontSize: 28 }}>{t.aiState[data.aiStatus]}</p>
          <p className="muted">
            {fmt(t.expires, { date: expires })} · {locale === "ar" ? label.ar : label.en}
          </p>
        </article>
        <article className="card">
          <h2>{t.liveTitle}</h2>
          <p style={{ fontSize: 28 }}>{fmt(t.hoursShort, { n: data.liveCredits })}</p>
          <p className="muted">{t.liveLead}</p>
          <button className="btn dark" type="button" onClick={() => setOpen(true)}>
            {t.redeemOpen}
          </button>
          <a className="btn" href="/wallet/pay" style={{ marginInlineStart: 8 }}>
            {t.iPaid}
          </a>
        </article>
      </div>
      <section className="card" style={{ marginBlockStart: 20 }}>
        <h2>
          {data.sharingExempt ? t.devicesTeacher : t.devicesStudent}
        </h2>
        {data.sharingExempt ? (
          <p className="muted">{t.teacherDevices}</p>
        ) : null}
        {(data.devices ?? []).length === 0 ? <p className="muted">{t.noDevices}</p> : null}
        {(data.devices ?? []).map((device) => (
          <p key={device.id}>
            {(locale === "ar" ? device.deviceNameAr : device.deviceName) || device.deviceName || device.deviceClass}
            {" · "}
            {device.createdAtBeirut || device.createdAt.slice(0, 16).replace("T", " ")}
            {device.current ? ` · ${t.thisDevice}` : ""}
          </p>
        ))}
      </section>
      <section className="card" style={{ marginBlockStart: 20, overflowX: "auto" }}>
        <h2>{t.history}</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.cols.when}</th>
              <th>{t.cols.kind}</th>
              <th>{t.cols.hours}</th>
              <th>{t.cols.code}</th>
              <th>{t.cols.note}</th>
            </tr>
          </thead>
          <tbody>
            {data.ledger.map((row) => (
              <tr key={row.id}>
                <td>{row.createdAt.slice(0, 16).replace("T", " ")}</td>
                <td>{row.kind}</td>
                <td>{row.hoursDelta > 0 ? `+${row.hoursDelta}` : row.hoursDelta}</td>
                <td>{row.code ?? "—"}</td>
                <td>{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {open ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t.topupTitle}>
          <div className="card modal-card">
            <h2>{t.topupTitle}</h2>
            <p className="muted">{t.topupLead}</p>
            <label>
              {t.code}
              <input value={code} onChange={(event) => setCode(event.target.value)} autoFocus />
            </label>
            <div className="row">
              <button className="btn dark" type="button" disabled={busy} onClick={() => void redeem()}>
                {busy ? t.redeeming : t.redeem}
              </button>
              <button className="btn" type="button" onClick={() => setOpen(false)}>
                {m.common.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {message ? <p className="success">{message}</p> : null}
    </main>
  );
}
