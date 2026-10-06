"use client";

import { useCallback, useState } from "react";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { HamzaActivity } from "@/lib/hamza/activityTypes";
import { teamMessages } from "@/lib/i18n/ns/team";
import { HamzaActivityView } from "./HamzaActivityView";
import { fetchHamzaActivity, teamErrorText } from "./teamApi";

/** Collapsible «Activity & cost» panel in Hamza's channel (loads on open; skeleton + error banner). */
export function HamzaActivityPanel() {
  const { locale } = useI18n();
  const tm = teamMessages[locale];
  const t = tm.hamza.activity;
  const [activity, setActivity] = useState<HamzaActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorText("");
    try {
      const result = await fetchHamzaActivity();
      if (result.ok) setActivity(result.data.activity);
      else setErrorText(teamErrorText(result, locale, tm));
    } catch {
      setErrorText(tm.errors.network);
    } finally {
      setLoading(false);
    }
  }, [locale, tm]);

  return (
    <details className="team-activity" onToggle={(event) => (event.currentTarget.open && !activity ? void load() : undefined)}>
      <summary>{t.open}</summary>
      {loading ? (
        <div aria-busy="true" className="team-activity-body">
          <SkeletonBlock lines={4} label={t.loading} />
        </div>
      ) : null}
      <ApiErrorBanner error={errorText} errorAr={errorText} />
      {activity && !loading ? <HamzaActivityView activity={activity} onReload={() => void load()} /> : null}
    </details>
  );
}
