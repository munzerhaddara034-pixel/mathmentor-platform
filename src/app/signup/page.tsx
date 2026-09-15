"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";

const ROLE_COPY: Record<UserRole, string> = {
  student: "طالب",
  teacher: "أستاذ / إدارة",
  parent: "ولي أمر",
};

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [linkedStudentEmail, setLinkedStudentEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role, linkedStudentEmail, phone }),
    });
    const payload = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error ?? "تعذر إنشاء الحساب");
      return;
    }
    window.location.assign("/dashboard");
  };

  return (
    <main className="shell auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">Math Mentor</p>
        <h1>حساب جديد</h1>
        <p className="muted">سجّل كطالب أو ولي أمر أو أستاذ. الحسابات التجريبية موثّقة في README.</p>
        <form onSubmit={(event) => void submit(event)} className="auth-form">
          <label>
            الاسم
            <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
          </label>
          <label>
            البريد الإلكتروني
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          {role === "student" ? (
            <label>
              رقم الهاتف (يظهر على الفيديو)
              <input value={phone} onChange={(event) => setPhone(event.target.value)} dir="ltr" placeholder="76532421" required />
            </label>
          ) : null}
          <label>
            الدور
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              {USER_ROLES.map((item) => (
                <option key={item} value={item}>
                  {ROLE_COPY[item]}
                </option>
              ))}
            </select>
          </label>
          {role === "parent" ? (
            <label>
              بريد الطالب المرتبط (اختياري)
              <input
                type="email"
                value={linkedStudentEmail}
                onChange={(event) => setLinkedStudentEmail(event.target.value)}
                placeholder="student@mathmentor.lb"
              />
            </label>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="btn dark" type="submit" disabled={busy}>
            إنشاء الحساب
          </button>
        </form>
        <p className="muted">
          لديك حساب؟ <Link href="/login">تسجيل الدخول</Link>
        </p>
      </section>
    </main>
  );
}
