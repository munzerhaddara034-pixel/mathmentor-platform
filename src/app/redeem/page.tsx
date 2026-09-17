"use client";

import { defaultSettings } from "@/lib/settings";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [planName, setPlanName] = useState("");
  const [need, setNeed] = useState(false);
  const [needKind, setNeedKind] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("need") ?? "";
    setNeed(kind === "subscription" || kind === "ai" || kind === "live");
    setNeedKind(kind);
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { user?: { name?: string; phone?: string } }) => {
        if (payload.user?.name) setName(payload.user.name);
        if (payload.user?.phone) setPhone(payload.user.phone);
      })
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, phone }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string; planName?: string; message?: string };
    setOk(Boolean(data.ok));
    setPlanName(data.planName ?? "");
    setMessage(data.message ?? data.error ?? "فشل التفعيل");
  };

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">تفعيل الاشتراك</p>
      <h1>أدخل كود البطاقة</h1>
      <p className="muted">اشترِ البطاقة من مكتب معتمد. للتجربة: MUNZER-GOLD-9A · MUNZER-AI-3K · MUNZER-LIVE-4C · MUNZER-BOTH-1X · شحن ساعات: MUNZER-HRS-2H</p>
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
      <div className="card activate-card">
        <label>
          الاسم
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          رقم الهاتف
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="76532421" />
        </label>
        <label>
          رمز البطاقة / البرومو
          <input value={code} onChange={(event) => setCode(event.target.value)} />
        </label>
        <button className="btn dark" type="button" onClick={() => void submit()}>
          تفعيل الدورة فوراً
        </button>
        {message ? <p className={ok ? "success" : "error"}>{message}</p> : null}
        {ok ? (
          <div className="welcome-banner">
            <h2>تم الاشتراك</h2>
            <p>مرحباً {name || "بك"} في منصة الأستاذ منذر. فُتحت لك: {planName}.</p>
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
