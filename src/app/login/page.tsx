"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const DEMO_ROWS = [
  { email: "student@mathmentor.local", role: "student", name: "Sara Nassar" },
  { email: "pending@mathmentor.local", role: "student (locked)", name: "Karim Fares" },
  { email: "parent@mathmentor.local", role: "parent", name: "Rania Fares" },
  { email: "teacher@mathmentor.local", role: "teacher", name: "Prof. Munzer Haddara" },
  { email: "admin@mathmentor.local", role: "admin", name: "Academy Admin" },
] as const;

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "";
  const reason = params.get("reason");
  const [email, setEmail] = useState("student@mathmentor.local");
  const [password, setPassword] = useState("demo-student");
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
    <main className="shell" dir="ltr">
      <p className="eyebrow">MathMentor · Prof. Munzer Haddara</p>
      <h1>Sign in / تسجيل الدخول</h1>
      <p className="muted">
        Interactive lessons are private. Students need an active promo/card. Teachers and admins use staff accounts.
      </p>
      {replaced ? (
        <div className="studio-teacher-error" role="alert">
          <p>This account signed in on another device. That session was closed.</p>
          <p dir="rtl" lang="ar">
            تم تسجيل الدخول لهذا الحساب من جهاز آخر. أُغلقت الجلسة السابقة.
          </p>
        </div>
      ) : null}
      <form className="card activate-card" onSubmit={(event) => void submit(event)}>
        <label>
          Email / البريد
          <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
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
      <section className="teacher-checklist" style={{ marginTop: 18 }}>
        <p className="eyebrow">Demo accounts · حسابات التجربة</p>
        <p className="muted">Local / Netlify QA only. A new login kicks the previous device.</p>
        <ul>
          {DEMO_ROWS.map((account) => (
            <li key={account.email}>
              <strong>{account.role}</strong> — {account.name}
              <div>
                <code>{account.email}</code>
              </div>
            </li>
          ))}
        </ul>
        <p className="muted">
          Passwords: <code>demo-student</code>, <code>demo-pending</code> (no subscription), <code>demo-parent</code>,{" "}
          <code>demo-teacher</code>, <code>demo-admin</code>. Unlock a pending student with card <code>MUNZER-GOLD-9A</code>{" "}
          on <Link href="/redeem">/redeem</Link>.
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell">Loading sign-in…</main>}>
      <LoginForm />
    </Suspense>
  );
}
