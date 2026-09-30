"use client";

import { defaultSettings } from "@/lib/settings";
import { fetchClientSession, refreshClientEntitlements, type ClientSessionPayload } from "@/lib/auth/clientSession";
import { ApiErrorBanner, Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
        setError(data.error ?? data.message ?? "Redeem failed.");
        setErrorAr(data.error ?? data.message ?? "فشل التفعيل");
        setMessage(data.error ?? data.message ?? "فشل التفعيل");
        return;
      }
      setOk(true);
      setPlanName(data.planName ?? "");
      setMessage(data.message ?? "تم التفعيل");
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
      setError("Network error.");
      setErrorAr("خطأ في الشبكة.");
      setMessage("خطأ في الشبكة");
    } finally {
      setBusy(false);
    }
  };

  if (sessionLoading) {
    return (
      <main className="shell" dir="rtl">
        <p className="eyebrow">تفعيل الاشتراك</p>
        <h1>أدخل كود البطاقة</h1>
        <SkeletonBlock lines={4} label="Loading session…" />
        <div style={{ marginTop: 12 }}>
          <Skeleton height={48} width="100%" label="Loading form…" />
        </div>
      </main>
    );
  }

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">تفعيل الاشتراك</p>
      <h1>أدخل كود البطاقة</h1>
      <p className="muted">اشترِ البطاقة من مكتب معتمد أو اطلب الكود من الأستاذ منذر حداره.</p>
      {need ? (
        <p className="studio-teacher-error" role="alert">
          {needKind === "ai"
            ? "AI_TIER or BOTH is required for the math solver and interactive lessons."
            : needKind === "live"
              ? "LIVE_TIER or BOTH is required to book Prof. Munzer Haddara."
              : "Your account is signed in but the subscription is not active. Redeem a card to open lessons."}
          <br />
          <span dir="rtl" lang="ar">
            {needKind === "live"
              ? "يلزم اشتراك الحصص المباشرة مع الأستاذ منذر حداره."
              : "الحساب مسجّل لكن الاشتراك غير مفعّل. أدخل كود البطاقة لفتح الدروس أو الحلّال."}
          </span>
        </p>
      ) : null}
      {entitlements && (entitlements.aiAccess || entitlements.liveAccess) ? (
        <p className="success" role="status">
          Active: {entitlements.subscriptionType ?? "plan"} · AI {entitlements.aiAccess ? "yes" : "no"} · Live{" "}
          {entitlements.liveAccess ? "yes" : "no"} · credits {entitlements.liveCredits ?? 0}
        </p>
      ) : null}
      <div className="card activate-card">
        <label>
          الاسم
          <input value={name} onChange={(event) => setName(event.target.value)} disabled={busy} />
        </label>
        <label>
          رقم الهاتف
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="76532421"
            disabled={busy}
          />
        </label>
        <label>
          رمز البطاقة / البرومو
          <input value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} />
        </label>
        <button className="btn dark" type="button" onClick={() => void submit()} disabled={busy || !code.trim()}>
          {busy ? "جاري التفعيل…" : "تفعيل الدورة فوراً"}
        </button>
        {busy ? <SkeletonBlock lines={2} label="Redeeming…" /> : null}
        <ApiErrorBanner error={error} errorAr={errorAr} />
        {message && ok ? <p className="success">{message}</p> : null}
        {ok ? (
          <div className="welcome-banner">
            <h2>تم الاشتراك</h2>
            <p>
              مرحباً {name || "بك"} في منصة الأستاذ منذر. فُتحت لك: {planName}.
              {entitlements?.aiAccess ? " AI unlocked instantly — no logout needed." : ""}
            </p>
            <Link className="btn ok" href="/math-solver">
              الحلّال
            </Link>
            <Link className="btn" href="/lessons/interactive">
              ابدأ الدروس
            </Link>
            <Link className="btn" href="/live">
              حجز مباشرة
            </Link>
          </div>
        ) : null}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        الخطط: {defaultSettings.plans.map((plan) => plan.arabicName).join(" · ")}
      </p>
    </main>
  );
}
