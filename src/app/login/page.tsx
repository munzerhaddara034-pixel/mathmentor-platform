"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { DEMO_ACCOUNTS } from "@/lib/auth/types";

function LoginForm() {
  const search = useSearchParams();
  const next = search.get("next") || "/dashboard";
  const [email, setEmail] = useState("student@mathmentor.lb");
  const [password, setPassword] = useState("student123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "تعذر الدخول");
      return;
    }
    window.location.assign(next.startsWith("/") ? next : "/dashboard");
  };

  return (
    <main className="shell auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">Math Mentor</p>
        <h1>تسجيل الدخول</h1>
        <p className="muted">ادخل كطالب أو أستاذ أو ولي أمر لمتابعة لوحة التحكم الخاصة بك.</p>
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <label>
            البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn dark" type="submit" disabled={busy}>
            دخول
          </button>
        </form>
        <p className="muted">
          ليس لديك حساب؟ <Link href="/signup">إنشاء حساب</Link>
        </p>
      </section>
      <aside className="card demo-card">
        <h2>حسابات التجربة</h2>
        <ul className="demo-list">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                className="ghost-link"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                {account.name}
              </button>
              <span className="muted">
                {account.email} · {account.password}
              </span>
            </li>
          ))}
        </ul>
      </aside>
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
