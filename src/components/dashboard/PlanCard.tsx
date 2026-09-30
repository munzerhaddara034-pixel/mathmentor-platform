"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { OverviewPlan } from "@/lib/dashboard/overview";
import { formatBeirut } from "@/lib/format/dates";
import { fmt } from "@/lib/i18n/format";

export function PlanCard({ plan }: { plan: OverviewPlan | null }) {
  const { locale, m } = useI18n();
  const t = m.dashboard;
  if (!plan || !plan.subscriptionType) {
    return (
      <section className="mm-plan glass" aria-label={t.planPlain}>
        <span className="mm-plan-chip muted">{t.planNone}</span>
        <h2>{t.planLocked}</h2>
        <p className="mm-plan-note">{t.planLockedBody}</p>
        <div className="mm-plan-actions">
          <Link href="/subscribe" className="v2-btn v2-btn-gold">
            {t.planSee}
          </Link>
          <Link href="/redeem" className="v2-btn v2-btn-glass">
            {t.planCode}
          </Link>
        </div>
      </section>
    );
  }
  const aiOpen = plan.aiStatus === "active";
  const until = plan.aiExpiresAt ? formatBeirut(plan.aiExpiresAt, { day: "numeric", month: "long", year: "numeric" }, locale) : "";
  const names: Record<string, string> = t.planNames;
  return (
    <section className="mm-plan glass" aria-label={t.planPlain}>
      <div className="mm-plan-head">
        <span className={`mm-plan-chip ${aiOpen ? "on" : "muted"}`}>{aiOpen ? t.planActive : t.planClosed}</span>
        {aiOpen && until ? <span className="mm-plan-until">{fmt(t.planUntil, { date: until })}</span> : null}
      </div>
      <h2>{names[plan.subscriptionType] ?? t.planPlain}</h2>
      <div className="mm-plan-stats">
        <div>
          <strong>{aiOpen ? t.solverOpen : t.solverClosed}</strong>
          <span>{t.solverLabel}</span>
        </div>
        <div>
          <strong className="ltr">{plan.liveCredits}</strong>
          <span>{t.liveTitle}</span>
        </div>
      </div>
      {aiOpen ? null : (
        <Link href="/subscribe" className="v2-btn v2-btn-gold mm-plan-cta">
          {t.planRenew}
        </Link>
      )}
    </section>
  );
}
