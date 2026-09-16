"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setErrorAr("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, next }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
        errorAr?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Login failed.");
        setErrorAr(payload.errorAr ?? "فشل تسجيل الدخول.");
        setBusy(false);
        return;
      }
      window.location.assign(payload.redirectTo || "/lessons/interactive");
    } catch {
      setError("Could not reach the login service.");
      setErrorAr("تعذّر الوصول إلى خدمة الدخول.");
      setBusy(false);
    }
  };

  return (
    <main className="shell login-page">
      <img className="login-logo" src="/brand/mathmentor-logo.svg" alt="MathMentor" width={96} height={96} />
      <h1>MathMentor · أكاديمية منذر حداره</h1>
      {replaced ? (
        <div className="studio-teacher-error" role="alert">
          <p>This account signed in on another device. That session was closed.</p>
          <p dir="rtl" lang="ar">
            تم تسجيل الدخول لهذا الحساب من جهاز آخر. أُغلقت الجلسة السابقة.
          </p>
        </div>
      ) : null}
      <form className="card activate-card login-card" onSubmit={(event) => void submit(event)}>
        <label>
          Email / البريد
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password / كلمة المرور
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? (
          <div className="studio-teacher-error" role="alert">
            <p>{error}</p>
            <p dir="rtl" lang="ar">
              {errorAr}
            </p>
          </div>
        ) : null}
        <button className="btn dark" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in / دخول"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell login-page">Loading sign-in…</main>}>
      <LoginForm />
    </Suspense>
  );
}
