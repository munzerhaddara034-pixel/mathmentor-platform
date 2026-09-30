"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { collectDeviceFingerprint } from "@/lib/auth/clientFingerprint";
import "@/styles/auth.css";

type LoginResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
  errorAr?: string;
};

function ReasonNotice({ reason }: { reason: string | null }) {
  if (reason === "replaced") {
    return (
      <AuthNotice>
        <p>تم تسجيل الدخول لهذا الحساب من جهاز آخر من النوع نفسه (هاتف أو حاسوب)، فأُغلقت الجلسة السابقة.</p>
      </AuthNotice>
    );
  }
  if (reason === "expired") {
    return (
      <AuthNotice>
        <p>انتهت الجلسة. يرجى تسجيل الدخول مجدداً.</p>
      </AuthNotice>
    );
  }
  return null;
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, next, fingerprint: collectDeviceFingerprint() }),
      });
      const payload = (await response.json()) as LoginResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.errorAr ?? "فشل تسجيل الدخول. تحقّق من البريد وكلمة المرور.");
        setBusy(false);
        return;
      }
      window.location.assign(payload.redirectTo || "/dashboard");
    } catch {
      setError("تعذّر الوصول إلى خدمة الدخول. تحقّق من الاتصال وحاول مجدداً.");
      setBusy(false);
    }
  };

  return (
    <AuthCard title="تسجيل الدخول" lead="أهلاً بعودتك. ادخل لمتابعة دروسك وحصصك.">
      <ReasonNotice reason={params.get("reason")} />
      <form onSubmit={(event) => void submit(event)} className="mm-auth-form">
        <label className="mm-field">
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            dir="ltr"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="username"
          />
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />
        {error ? (
          <AuthNotice tone="error">
            <p>{error}</p>
          </AuthNotice>
        ) : null}
        <button className="btn dark" type="submit" disabled={busy}>
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
      <p className="mm-auth-foot">
        ليس لديك حساب؟ <Link href="/signup">أنشئ حساباً مجانياً</Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mm-auth" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  );
}
