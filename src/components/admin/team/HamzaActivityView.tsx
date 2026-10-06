"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import type { HamzaActivity } from "@/lib/hamza/activityTypes";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { beirutDateTime, taskStatusLabel, usd } from "./hamzaFormat";

type Props = { activity: HamzaActivity; onReload: () => void };

/** Month spend vs cap, counts, cost by model, recent tasks and the hamza.* audit trail (mobile: stacked list). */
export function HamzaActivityView({ activity, onReload }: Props) {
  const { locale } = useI18n();
  const t = teamMessages[locale].hamza;
  const a = t.activity;
  const ratio = activity.monthCapUsd ? Math.min(1, activity.monthUsd / activity.monthCapUsd) : 0;
  return (
    <div className="team-activity-body">
      <p className="team-activity-month">
        <strong>{fmt(a.month, { usd: usd(activity.monthUsd), cap: usd(activity.monthCapUsd) })}</strong> · {activity.monthKey}
      </p>
      <div className="team-activity-meter" role="meter" aria-valuemin={0} aria-valuemax={activity.monthCapUsd} aria-valuenow={activity.monthUsd} aria-label={a.title}>
        <span style={{ inlineSize: `${Math.round(ratio * 100)}%` }} />
      </div>
      <p className="muted">{fmt(a.caps, { task: usd(activity.taskCapUsd), max: usd(activity.taskMaxUsd), month: usd(activity.monthCapUsd) })}</p>
      <p>{fmt(a.counts, activity.counts)}</p>
      {activity.byModel.length ? (
        <>
          <h3 className="team-activity-h">{a.byModel}</h3>
          <ul className="team-activity-list">
            {activity.byModel.map((row) => (
              <li key={row.model} dir="ltr">
                {row.model} — {usd(row.usd)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h3 className="team-activity-h">{a.recentTasks}</h3>
      {activity.tasks.length ? (
        <ul className="team-activity-list">
          {activity.tasks.slice(0, 10).map((task) => (
            <li key={task.id}>
              <span className={`team-task-pill is-${task.status}`}>{taskStatusLabel(task.status, t.task)}</span> {task.requestText.slice(0, 80)} · {usd(task.cost.usd)} · {beirutDateTime(task.createdAt, locale)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{a.empty}</p>
      )}
      <h3 className="team-activity-h">{a.events}</h3>
      <ul className="team-activity-list team-activity-events">
        {activity.events.slice(0, 30).map((event, index) => (
          <li key={`${event.at}-${index}`}>
            <time dateTime={event.at}>{beirutDateTime(event.at, locale)}</time> <code dir="ltr">{event.action}</code>
            {event.target ? <span dir="ltr"> · {event.target}</span> : null}
            {event.actorEmail ? <span className="muted"> · {event.actorEmail}</span> : null}
          </li>
        ))}
      </ul>
      <button type="button" className="btn ghost-btn" onClick={onReload}>
        ↻ {a.title}
      </button>
    </div>
  );
}
