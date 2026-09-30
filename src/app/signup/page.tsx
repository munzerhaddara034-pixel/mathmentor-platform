"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { authErrorMessage, type AuthErrorPayload } from "@/components/auth/authErrors";
import { fmt } from "@/lib/i18n/format";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { USER_ROLES, type UserRole } from "@/lib/auth/types";
import "@/styles/auth.css";

/** Staff accounts are provisioned by the academy; self-signup is student / parent only. */
const SIGNUP_ROLES = USER_ROLES.filter((item) => item !== "teacher");

export default function SignupPage() {
  const { m } = useI18n();
  const a = m.auth;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [linkedStudentEmail, setLinkedStudentEmail] = useState("");
  const [error, setError] = useState("");
  /** Set once the account exists and is waiting for its e-mail confirmation. */
  const [sent, setSent] = useState<{ email: string; emailSent: boolean } | null>(null);
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
      const payload = (await response.json()) as AuthErrorPayload & {
        verificationRequired?: boolean;
        emailSent?: boolean;
      };
      if (!response.ok) {
        setError(authErrorMessage(payload, a, a.signupFailed));
        setBusy(false);
        return;
      }
      if (payload.verificationRequired) {
        // No session yet: the account activates after the e-mailed link + sign-in.
        setSent({ email, emailSent: payload.emailSent !== false });
        setPassword("");
        setBusy(false);
        return;
      }
    } catch {
      setError(a.signupNetwork);
      setBusy(false);
      return;
    }
    window.location.assign("/dashboard");
  };

  if (sent) {
    return (
      <AuthCard title={a.verifySentTitle} lead={sent.emailSent ? fmt(a.verifySent, { email: sent.email }) : a.verifyNotSent}>
        <AuthNotice>
          <p>{a.verifyLinkHint}</p>
        </AuthNotice>
        <Link className="v2-btn v2-btn-gold v2-btn-block" href="/login">
          {a.verifyGoLogin}
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={a.signupTitle} lead={a.signupLead}>
      <form onSubmit={(event) => void submit(event)} className="mm-auth-form">
        <label className="mm-field">
          <span>{a.name}</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
        </label>
        <label className="mm-field">
          <span>{a.email}</span>
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
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
        <p className="mm-auth-hint">{a.passwordRule}</p>
        <label className="mm-field">
          <span>{a.iAm}</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            {SIGNUP_ROLES.map((item) => (
              <option key={item} value={item}>
                {a.roles[item]}
              </option>
            ))}
          </select>
        </label>
        {role === "parent" ? (
          <label className="mm-field">
            <span>{a.linkedEmail}</span>
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
        <button className="v2-btn v2-btn-gold v2-btn-block" type="submit" disabled={busy}>
          {busy ? a.signupBusy : a.signupSubmit}
        </button>
      </form>
      <p className="mm-auth-foot">
        {a.haveAccount} <Link href="/login">{a.loginLink}</Link>
      </p>
    </AuthCard>
  );
}
