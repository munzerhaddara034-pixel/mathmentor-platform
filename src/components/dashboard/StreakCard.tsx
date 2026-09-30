"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import type { OverviewStreak } from "@/lib/dashboard/overview";
import { fmt, plural } from "@/lib/i18n/format";

const RING = 2 * Math.PI * 26;

/** Streak ring: fills over a 7-day week (a full ring = the streak-7 badge), real streak + XP. */
export function StreakCard({ streak }: { streak: OverviewStreak }) {
  const { locale, m } = useI18n();
  const t = m.dashboard;
  const progress = Math.min(streak.streakDays, 7) / 7;
  return (
    <div className="v2-streak">
      <div className="v2-streak-row">
        <span className="v2-streak-num">
          <b className="ltr">{streak.streakDays}</b> <small>{plural(streak.streakDays, t.streakDays)}</small>
        </span>
        <span className="v2-ring-box" aria-hidden="true">
          <svg className="v2-ring-arc" viewBox="0 0 64 64" width="64" height="64">
            <circle cx="32" cy="32" r="26" className="track" />
            <circle cx="32" cy="32" r="26" className="bar" strokeDasharray={RING} strokeDashoffset={RING * (1 - progress)} />
          </svg>
          <Icon name="fire" size={22} />
        </span>
      </div>
      <p className="v2-muted v2-small">{fmt(t.streakXp, { n: streak.xp })}</p>
      {streak.badges.length ? (
        <ul className="mm-badges" aria-label={t.badges}>
          {streak.badges.map((badge) => (
            <li key={badge.id}>{locale === "ar" ? badge.titleAr : badge.title}</li>
          ))}
        </ul>
      ) : (
        <p className="v2-muted v2-small">{t.streakHint}</p>
      )}
    </div>
  );
}
