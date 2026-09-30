"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";
import { LiveCreditsCard } from "./LiveCreditsCard";
import { NextSessionCard } from "./NextSessionCard";
import { PlanCard } from "./PlanCard";
import { StreakCard } from "./StreakCard";
import { useOverview } from "./OverviewContext";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

/** Client widgets fed by /api/me/overview (skeleton → data | error with retry). */
function useWidget() {
  const { m } = useI18n();
  const overview = useOverview();
  const skeleton = (lines: number, tall = false) => <WidgetSkeleton lines={lines} tall={tall} label={m.common.loading} />;
  const error = (message: string) => <WidgetError message={message} onRetry={overview.retry} retryLabel={m.common.retry} />;
  return { ...overview, m, skeleton, error };
}

export function PlanWidget() {
  const { state, m, skeleton, error } = useWidget();
  if (state.status === "loading") return <div className="mm-card mm-widget">{skeleton(4, true)}</div>;
  if (state.status === "error") return <div className="mm-card mm-widget">{error(state.message)}</div>;
  if (state.overview.unavailable.includes("plan")) return <div className="mm-card mm-widget">{error(m.common.unavailable)}</div>;
  return <PlanCard plan={state.overview.plan} />;
}

export function LiveCreditsWidget() {
  const { state, m, skeleton, error } = useWidget();
  return (
    <section className="mm-card mm-widget v2-stat" aria-labelledby="v2-live-credits">
      <h2 id="v2-live-credits" className="v2-stat-title">
        {m.dashboard.liveTitle}
      </h2>
      {state.status === "loading" ? skeleton(2) : null}
      {state.status === "error" ? error(state.message) : null}
      {state.status === "ready" ? (
        state.overview.unavailable.includes("plan") ? error(m.common.unavailable) : <LiveCreditsCard plan={state.overview.plan} />
      ) : null}
    </section>
  );
}

export function NextSessionWidget({ teacherStatus }: { teacherStatus: TeacherLiveStatus }) {
  const { state, m, skeleton, error } = useWidget();
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-next-session">
      <div className="mm-widget-head">
        <h2 id="mm-next-session">{m.dashboard.nextTitle}</h2>
      </div>
      {state.status === "loading" ? skeleton(3) : null}
      {state.status === "error" ? error(state.message) : null}
      {state.status === "ready" ? (
        state.overview.unavailable.includes("sessions") ? (
          error(m.common.unavailable)
        ) : (
          <NextSessionCard session={state.overview.nextSession} teacherStatus={teacherStatus} />
        )
      ) : null}
    </section>
  );
}

export function StreakWidget() {
  const { state, m, skeleton, error } = useWidget();
  return (
    <section className="mm-card mm-widget v2-stat" aria-labelledby="v2-streak-title">
      <h2 id="v2-streak-title" className="v2-stat-title">
        {m.dashboard.streakTitle}
      </h2>
      {state.status === "loading" ? skeleton(2) : null}
      {state.status === "error" ? error(state.message) : null}
      {state.status === "ready" ? (state.overview.streak ? <StreakCard streak={state.overview.streak} /> : error(m.common.unavailable)) : null}
    </section>
  );
}
