"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { collectDeviceFingerprint } from "@/lib/auth/clientFingerprint";

type LoginResponse = {
  ok?: boolean;
  redirectTo?: string;
  error?: string;
  errorAr?: string;
};

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "";
  const reason = params.get("reason");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [busy, setBusy] = useState(false);

  const replaced = reason === "replaced";
  const expired = reason === "expired";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setErrorAr("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, next, fingerprint: collectDeviceFingerprint() }),
      });
      const payload = (await response.json()) as LoginResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Login failed.");
        setErrorAr(payload.errorAr ?? "فشل تسجيل الدخول.");
        setBusy(false);
        return;
      }
      window.location.assign(payload.redirectTo || "/dashboard");
    } catch {
      setError("Could not reach the login service.");
      setErrorAr("تعذّر الوصول إلى خدمة الدخول.");
      setBusy(false);
    }
  };

  return (
    <main className="shell auth-shell">
      <section className="card auth-card">
        <img className="login-logo" src="/brand/mathmentor-logo.svg" alt="MathMentor" width={96} height={96} />
        <p className="eyebrow">MathMentor · أكاديمية منذر حداره</p>
        <h1>تسجيل الدخول</h1>
        <p className="muted">ادخل كطالب أو أستاذ أو ولي أمر لمتابعة لوحة التحكم الخاصة بك.</p>
        {replaced ? (
          <div className="studio-teacher-error" role="alert">
            <p dir="rtl" lang="ar">
              تم تسجيل الدخول لهذا الحساب من جهاز آخر من النوع نفسه (هاتف أو حاسوب). أُغلقت الجلسة السابقة.
            </p>
            <p dir="ltr">This account signed in on another device of the same type (phone or computer). That session was closed.</p>
          </div>
        ) : expired ? (
          <div className="studio-teacher-error" role="alert">
            <p dir="rtl" lang="ar">
              انتهت الجلسة. يرجى تسجيل الدخول مجدداً.
            </p>
            <p dir="ltr">Your session ended. Please sign in again.</p>
          </div>
        ) : null}
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <label>
            البريد الإلكتروني / Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label>
            كلمة المرور / Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? (
            <div className="studio-teacher-error" role="alert">
              <p dir="rtl" lang="ar">
                {errorAr}
              </p>
              <p dir="ltr">{error}</p>
            </div>
          ) : null}
          <button className="btn dark" type="submit" disabled={busy}>
            {busy ? "جارٍ الدخول…" : "دخول / Sign in"}
          </button>
        </form>
        <p className="muted">
          ليس لديك حساب؟ <Link href="/signup">إنشاء حساب</Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell">جارٍ التحميل…</main>}>
      <LoginForm />
    </Suspense>
  );
}
