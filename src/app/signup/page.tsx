"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";
import "@/styles/auth.css";

const ROLE_COPY: Record<UserRole, string> = {
  student: "طالب",
  teacher: "أستاذ / إدارة",
  parent: "ولي أمر",
};

/** Staff accounts are provisioned by the academy; self-signup is student / parent only. */
const SIGNUP_ROLES = USER_ROLES.filter((item) => item !== "teacher");

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [linkedStudentEmail, setLinkedStudentEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, linkedStudentEmail }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "تعذّر إنشاء الحساب");
        setBusy(false);
        return;
      }
    } catch {
      setError("تعذّر الوصول إلى الخدمة. تحقّق من الاتصال وحاول مجدداً.");
      setBusy(false);
      return;
    }
    window.location.assign("/dashboard");
  };

  return (
    <AuthCard title="حساب جديد" lead="سجّل كطالب أو ولي أمر. حسابات الأساتذة تُنشأ من إدارة المنصة.">
      <form onSubmit={(event) => void submit(event)} className="mm-auth-form">
        <label className="mm-field">
          <span>الاسم</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
        </label>
        <label className="mm-field">
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            dir="ltr"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" minLength={6} />
        <label className="mm-field">
          <span>أنا</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {SIGNUP_ROLES.map((item) => (
              <option key={item} value={item}>
                {ROLE_COPY[item]}
              </option>
            ))}
          </select>
        </label>
        {role === "parent" ? (
          <label className="mm-field">
            <span>بريد الطالب المرتبط (اختياري)</span>
            <input
              type="email"
              dir="ltr"
              value={linkedStudentEmail}
              onChange={(event) => setLinkedStudentEmail(event.target.value)}
            />
          </label>
        ) : null}
        {error ? (
          <AuthNotice tone="error">
            <p>{error}</p>
          </AuthNotice>
        ) : null}
        <button className="btn dark" type="submit" disabled={busy}>
          {busy ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب"}
        </button>
      </form>
      <p className="mm-auth-foot">
        لديك حساب؟ <Link href="/login">سجّل الدخول</Link>
      </p>
    </AuthCard>
  );
}
