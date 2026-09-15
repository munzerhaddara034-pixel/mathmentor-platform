"use client";

import { DEMO_PROMO_CODES, PROMO_CODE_LENGTH, isValidPromoCode, normalizePromoCode, scopeLabel } from "@/lib/access";
import type { SessionUser } from "@/lib/auth/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export function RedeemPageView() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [planName, setPlanName] = useState("");
  const normalized = normalizePromoCode(code);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "include" })
      .then((response) => response.json())
      .then((payload: { user?: SessionUser | null }) => setUser(payload.user ?? null));
  }, []);

  const submit = async () => {
    const response = await fetch("/api/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code: normalized }),
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
      <p className="muted">
        الكود {PROMO_CODE_LENGTH} خانة، ويُحفظ على حسابك في قاعدة الجلسات — ليس ملفاً مشتركاً. أكواد التجربة:{" "}
        {DEMO_PROMO_CODES.map((item) => item.code).join(" · ")}
      </p>
      {user === null ? (
        <div className="card activate-card">
          <p>سجّل الدخول كطالب ثم أدخل الكود.</p>
          <Link className="btn dark" href="/login?next=/redeem">
            تسجيل الدخول
          </Link>
        </div>
      ) : (
        <div className="card activate-card">
          <p className="muted">الحساب: {user?.name}</p>
          <label>
            رمز البطاقة / البرومو
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={16}
              dir="ltr"
              placeholder="MMUNLOCKALL1"
            />
          </label>
          <button className="btn dark" type="button" disabled={!isValidPromoCode(normalized)} onClick={() => void submit()}>
            تفعيل الدورة فوراً
          </button>
          {message ? <p className={ok ? "success" : "error"}>{message}</p> : null}
          {ok ? (
            <div className="welcome-banner">
              <h2>تم الاشتراك</h2>
              <p>
                مرحباً {user?.name} في منصة الأستاذ منذر. فُتحت لك: {planName}.
              </p>
              <Link className="btn ok" href="/classroom">
                ابدأ الدروس
              </Link>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              {DEMO_PROMO_CODES.map((item) => `${item.code} → ${scopeLabel(item.scopeKind, item.scopeId)}`).join(" · ")}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
