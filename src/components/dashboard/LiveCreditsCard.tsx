"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { OverviewPlan } from "@/lib/dashboard/overview";

/** Remaining live-session credits from the real plan (no invented totals). */
export function LiveCreditsCard({ plan }: { plan: OverviewPlan | null }) {
  const { m } = useI18n();
  const t = m.dashboard;
  const credits = plan?.liveCredits ?? 0;
  if (credits <= 0) {
    return (
      <div className="v2-credits">
        <p className="v2-muted v2-small">{t.liveNone}</p>
        <Link href="/subscribe" className="mm-link">
          {t.liveUpgrade}
        </Link>
      </div>
    );
  }
  return (
    <div className="v2-credits">
      <span className="v2-streak-num">
        <b className="ltr">{credits}</b> <small>{t.liveUnit}</small>
      </span>
      <Link href="/live" className="mm-link">
        {t.liveBook}
      </Link>
    </div>
  );
}
