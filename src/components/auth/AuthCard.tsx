"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";

/**
 * Single centered auth card with the brand header («منذر حداره» / Munzer Haddara · MathMentor) and an
 * inline language picker, so visitors can switch language before logging in or signing up.
 */
export function AuthCard({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const { m } = useI18n();
  return (
    <main className="mm-auth">
      <section className="mm-auth-card">
        <header className="mm-auth-brand">
          <img src="/brand/mathmentor-logo.svg" alt="" width={56} height={56} />
          <div>
            <strong>{m.brand.name}</strong>
            <bdi dir="ltr">{m.brand.sub}</bdi>
          </div>
        </header>
        <div className="mm-auth-lang">
          <span>{m.locale.label}</span>
          <LocaleSwitcher variant="inline" />
        </div>
        <h1>{title}</h1>
        {lead ? <p className="mm-auth-lead">{lead}</p> : null}
        {children}
      </section>
    </main>
  );
}

export function AuthNotice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <div className={`mm-auth-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}
