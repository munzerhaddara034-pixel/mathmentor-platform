"use client";

import { NextSessionCard } from "./NextSessionCard";
import { PlanCard } from "./PlanCard";
import { StreakCard } from "./StreakCard";
import { useOverview } from "./OverviewContext";
import { WidgetError, WidgetSkeleton } from "./WidgetStates";

const UNAVAILABLE = "تعذّر تحميل هذا القسم الآن.";

/** Client widgets fed by /api/me/overview (skeleton → data | error with retry). */
export function PlanWidget() {
  const { state, retry } = useOverview();
  if (state.status === "loading") return <div className="mm-plan is-loading"><WidgetSkeleton lines={4} tall /></div>;
  if (state.status === "error") return <div className="mm-card mm-widget"><WidgetError message={state.message} onRetry={retry} /></div>;
  if (state.overview.unavailable.includes("plan")) return <div className="mm-card mm-widget"><WidgetError message={UNAVAILABLE} onRetry={retry} /></div>;
  return <PlanCard plan={state.overview.plan} />;
}

export function NextSessionWidget() {
  const { state, retry } = useOverview();
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-next-session">
      <div className="mm-widget-head">
        <h2 id="mm-next-session">حصتك القادمة</h2>
      </div>
      {state.status === "loading" ? <WidgetSkeleton lines={3} /> : null}
      {state.status === "error" ? <WidgetError message={state.message} onRetry={retry} /> : null}
      {state.status === "ready" ? (
        state.overview.unavailable.includes("sessions") ? (
          <WidgetError message={UNAVAILABLE} onRetry={retry} />
        ) : (
          <NextSessionCard session={state.overview.nextSession} />
        )
      ) : null}
    </section>
  );
}

export function StreakWidget() {
  const { state, retry } = useOverview();
  return (
    <section className="mm-card mm-widget" aria-label="سلسلة الدراسة">
      {state.status === "loading" ? <WidgetSkeleton lines={3} /> : null}
      {state.status === "error" ? <WidgetError message={state.message} onRetry={retry} /> : null}
      {state.status === "ready" ? (
        state.overview.streak ? (
          <StreakCard streak={state.overview.streak} />
        ) : (
          <WidgetError message={UNAVAILABLE} onRetry={retry} />
        )
      ) : null}
    </section>
  );
}
