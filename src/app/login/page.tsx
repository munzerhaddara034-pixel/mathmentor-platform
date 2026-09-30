"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { PasswordField } from "@/components/auth/PasswordField";
import { authErrorMessage, type AuthErrorPayload } from "@/components/auth/authErrors";
import { collectDeviceFingerprint } from "@/lib/auth/clientFingerprint";
import { useI18n } from "@/components/i18n/I18nProvider";
import "@/styles/auth.css";

type LoginResponse = AuthErrorPayload & {
  ok?: boolean;
  redirectTo?: string;
  /** Account exists but its e-mail is not confirmed yet (a new link may have been sent). */
  needsVerification?: boolean;
};

function ReasonNotice({ reason }: { reason: string | null }) {
  const { m } = useI18n();
  if (reason === "replaced") {
    return (
      <AuthNotice>
        <p>{m.auth.replaced}</p>
      </AuthNotice>
    );
  }
  if (reason === "expired") {
    return (
      <AuthNotice>
        <p>{m.auth.expired}</p>
      </AuthNotice>
    );
  }
  return null;
}

function LoginForm() {
  const { m } = useI18n();
  const a = m.auth;
  const params = useSearchParams();
  const next = params.get("next") || "";
  const verifyToken = params.get("verify") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setPendingVerification("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, next, verifyToken: verifyToken || undefined, fingerprint: collectDeviceFingerprint() }),
      });
      const payload = (await response.json()) as LoginResponse;
      if (!response.ok || !payload.ok) {
        const message = authErrorMessage(payload, a, a.loginFailed);
        if (payload.needsVerification) setPendingVerification(message);
        else setError(message);
        setBusy(false);
        return;
      }
      window.location.assign(payload.redirectTo || "/dashboard");
    } catch {
      setError(a.loginNetwork);
      setBusy(false);
    }
  };

  return (
    <AuthCard title={a.loginTitle} lead={a.loginLead}>
      <ReasonNotice reason={params.get("reason")} />
      {verifyToken ? (
        <AuthNotice>
          <p>{a.verifyLinkHint}</p>
        </AuthNotice>
      ) : null}
      <form onSubmit={(event) => void submit(event)} className="mm-auth-form">
        <label className="mm-field">
          <span>{a.email}</span>
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
        {pendingVerification ? (
          <AuthNotice>
            <p>{pendingVerification}</p>
          </AuthNotice>
        ) : null}
        {error ? (
          <AuthNotice tone="error">
            <p>{error}</p>
          </AuthNotice>
        ) : null}
        <button className="v2-btn v2-btn-gold v2-btn-block" type="submit" disabled={busy}>
          {busy ? a.loginBusy : a.loginSubmit}
        </button>
      </form>
      <p className="mm-auth-foot">
        {a.noAccount} <Link href="/signup">{a.createFree}</Link>
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
