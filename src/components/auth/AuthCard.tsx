import type { ReactNode } from "react";
import { Ltr } from "@/components/ui/Ltr";

/** Single centered auth card with the brand header (منذر حداره · MathMentor). */
export function AuthCard({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <main className="mm-auth">
      <section className="mm-auth-card">
        <header className="mm-auth-brand">
          <img src="/brand/mathmentor-logo.svg" alt="" width={56} height={56} />
          <div>
            <strong>منذر حداره</strong>
            <Ltr>MathMentor</Ltr>
          </div>
        </header>
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
