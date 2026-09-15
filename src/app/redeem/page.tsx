"use client";

import { defaultSettings } from "@/lib/settings";
import Link from "next/link";
import { useState } from "react";

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [planName, setPlanName] = useState("");

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
      <p className="muted">اشترِ البطاقة من مكتب معتمد. للتجربة: MUNZER-GOLD-9A</p>
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
            <Link className="btn ok" href="/classroom">
              ابدأ الدروس
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
