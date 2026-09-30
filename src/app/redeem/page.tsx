"use client";

import { defaultSettings } from "@/lib/settings";
import { fetchClientSession, refreshClientEntitlements, type ClientSessionPayload } from "@/lib/auth/clientSession";
import { ApiErrorBanner, Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { accountMessages } from "@/lib/i18n/ns/account";

type RedeemResponse = {
  ok?: boolean;
  error?: string;
  planName?: string;
  message?: string;
  aiAccess?: boolean;
  liveAccess?: boolean;
  subscribed?: boolean;
  subscriptionType?: string | null;
  liveCredits?: number;
};

export default function RedeemPage() {
  const router = useRouter();
  const { locale, m } = useI18n();
  const t = useNs(accountMessages).redeem;
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [planName, setPlanName] = useState("");
  const [need, setNeed] = useState(false);
  const [needKind, setNeedKind] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [entitlements, setEntitlements] = useState<Pick<
    ClientSessionPayload,
    "aiAccess" | "liveAccess" | "subscriptionType" | "liveCredits"
  > | null>(null);
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("need") ?? "";
    setNeed(kind === "subscription" || kind === "ai" || kind === "live");
    setNeedKind(kind);
    void fetchClientSession()
      .then((payload) => {
        if (payload.user?.name) setName(payload.user.name);
        if (payload.user?.phone) setPhone(payload.user.phone);
        if (payload.ok) {
          setEntitlements({
            aiAccess: payload.aiAccess,
            liveAccess: payload.liveAccess,
            subscriptionType: payload.subscriptionType ?? null,
            liveCredits: payload.liveCredits,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setSessionLoading(false));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError("");
    setErrorAr("");
    setMessage("");
    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code, name, phone }),
      });
      const data = (await response.json()) as RedeemResponse;
      if (!response.ok || !data.ok) {
        setOk(false);
        setError(data.error ?? data.message ?? t.failed);
        setErrorAr(data.error ?? data.message ?? t.failed);
        setMessage(data.error ?? data.message ?? t.failed);
        return;
      }
      setOk(true);
      setPlanName(data.planName ?? "");
      setMessage(data.message ?? t.doneTitle);
      setEntitlements({
        aiAccess: data.aiAccess,
        liveAccess: data.liveAccess,
        subscriptionType: data.subscriptionType ?? null,
        liveCredits: data.liveCredits,
      });
      // Immediate unlock: refetch session entitlements + refresh RSC trees (no logout).
      await refreshClientEntitlements();
      router.refresh();
    } catch {
      setOk(false);
      setError(t.network);
      setErrorAr(t.network);
      setMessage(t.network);
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading) {
    return (
      <main className="shell">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <SkeletonBlock lines={4} label={t.loadingSession} />
        <div style={{ marginBlockStart: 12 }}>
          <Skeleton height={48} width="100%" label={t.loadingForm} />
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      {need ? (
        <p className="studio-teacher-error" role="alert">
          {needKind === "ai" ? t.needAi : needKind === "live" ? t.needLive : t.needAny}
        </p>
      ) : null}
      {entitlements && (entitlements.aiAccess || entitlements.liveAccess) ? (
        <p className="success" role="status">
          {fmt(t.active, {
            plan: entitlements.subscriptionType ?? t.plan,
            ai: entitlements.aiAccess ? m.common.yes : m.common.no,
            live: entitlements.liveAccess ? m.common.yes : m.common.no,
            credits: entitlements.liveCredits ?? 0,
          })}
        </p>
      ) : null}
      <div className="card activate-card">
        <label>
          {t.name}
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
        </label>
        <label>
          {t.phone}
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="76532421"
            disabled={busy}
          />
        </label>
        <label>
          {t.code}
          <input value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
        </label>
        <button className="btn dark" type="button" onClick={() => void submit()} disabled={busy || !code.trim()}>
          {busy ? t.busy : t.submit}
        </button>
        {busy ? <SkeletonBlock lines={2} label={t.busy} /> : null}
        <ApiErrorBanner error={error} errorAr={errorAr} />
        {message && ok ? <p className="success">{message}</p> : null}
        {ok ? (
          <div className="welcome-banner">
            <h2>{t.doneTitle}</h2>
            <p>
              {fmt(t.doneLead, { name: name ? ` ${name}` : "", plan: planName })}
              {entitlements?.aiAccess ? ` ${t.aiUnlocked}` : ""}
            </p>
            <Link className="btn ok" href="/math-solver">
              {t.solver}
            </Link>
            <Link className="btn" href="/lessons/interactive">
              {t.startLessons}
            </Link>
            <Link className="btn" href="/live">
              {t.bookLive}
            </Link>
          </div>
        ) : null}
      </div>
      <p className="muted" style={{ marginBlockStart: 16 }}>
        {t.plans} {defaultSettings.plans.map((plan) => (locale === "ar" ? plan.arabicName : plan.name)).join(" · ")}
      </p>
    </main>
  );
}
