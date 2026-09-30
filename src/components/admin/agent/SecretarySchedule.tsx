"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { agentMessages, type AgentMessages } from "@/lib/i18n/ns/agent";

export type SecretaryAppointmentRow = {
  id: string;
  title: string;
  dateTime: string;
  contactPerson?: string;
  status: string;
  notes?: string;
  source?: string;
};

export type SecretaryReminderRow = {
  id: string;
  task: string;
  priority: string;
  dueDate: string;
  status: string;
  source?: string;
};

type TimeFilter = "today" | "upcoming" | "all";
type KindFilter = "all" | "appointments" | "reminders";

function beirutDayKey(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function formatBeirut(iso: string, locale: Locale): string {
  try {
    return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
      timeZone: "Asia/Beirut",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

type SecretaryCopy = AgentMessages["secretary"];

function priorityLabel(p: string, t: SecretaryCopy): string {
  if (p === "high") return t.priority.high;
  if (p === "low") return t.priority.low;
  return t.priority.medium;
}

function statusLabelAppt(s: string, t: SecretaryCopy): string {
  if (s === "scheduled" || s === "pending" || s === "completed" || s === "cancelled") return t.status[s];
  return s;
}

type Props = {
  appointments?: SecretaryAppointmentRow[];
  reminders?: SecretaryReminderRow[];
};

export function SecretarySchedule({ appointments = [], reminders = [] }: Props) {
  const { locale } = useI18n();
  const t = agentMessages[locale].secretary;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const todayKey = useMemo(() => beirutDayKey(new Date().toISOString()), []);

  const pendingAppts = useMemo(() => {
    return appointments
      .filter((a) => a.status === "scheduled" || a.status === "pending")
      .filter((a) => {
        const day = beirutDayKey(a.dateTime);
        if (timeFilter === "today") return day === todayKey;
        if (timeFilter === "upcoming") return day > todayKey;
        return true;
      })
      .sort((a, b) => a.dateTime.localeCompare(b.dateTime));
  }, [appointments, timeFilter, todayKey]);

  const openReminders = useMemo(() => {
    return reminders
      .filter((r) => r.status === "open")
      .filter((r) => {
        const day = beirutDayKey(r.dueDate);
        if (timeFilter === "today") return day === todayKey || day < todayKey;
        if (timeFilter === "upcoming") return day > todayKey;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [reminders, timeFilter, todayKey]);

  const showAppts = kindFilter === "all" || kindFilter === "appointments";
  const showRems = kindFilter === "all" || kindFilter === "reminders";

  return (
    <section id="agent-secretary-schedule" className="card agent-panel agent-secretary">
      <h2>{t.title}</h2>
      <p className="muted">{fmt(t.rolesLine, { roles: t.roles.join(" · ") })}</p>
      <p className="muted">{t.lead}</p>

      <div className="agent-secretary-filters" role="toolbar" aria-label={t.filterLabel}>
        <div className="agent-actions">
          {(
            [
              ["today", t.today],
              ["upcoming", t.upcoming],
              ["all", t.all],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn ghost-btn${timeFilter === id ? " agent-filter-active" : ""}`}
              aria-pressed={timeFilter === id}
              onClick={() => setTimeFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="agent-actions">
          {(
            [
              ["all", t.all],
              ["appointments", t.appointments],
              ["reminders", t.reminders],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn ghost-btn${kindFilter === id ? " agent-filter-active" : ""}`}
              aria-pressed={kindFilter === id}
              onClick={() => setKindFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showAppts ? (
        <div className="agent-secretary-block">
          <h3>{fmt(t.apptTitle, { n: pendingAppts.length })}</h3>
          {pendingAppts.length ? (
            <ul className="agent-secretary-list">
              {pendingAppts.map((a) => (
                <li key={a.id} className="agent-secretary-card">
                  <div className="agent-secretary-card-head">
                    <strong dir="auto">{a.title}</strong>
                    <span className="agent-secretary-badge">{statusLabelAppt(a.status, t)}</span>
                  </div>
                  <p className="muted">
                    {formatBeirut(a.dateTime, locale)}
                    {a.contactPerson ? ` · ${a.contactPerson}` : ""}
                  </p>
                  {a.notes ? (
                    <p className="muted" dir="auto">
                      {a.notes}
                    </p>
                  ) : null}
                  <p className="agent-related-ids muted" dir="ltr">
                    {a.id}
                    {a.source ? ` · ${a.source}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.noAppts}</p>
          )}
        </div>
      ) : null}

      {showRems ? (
        <div className="agent-secretary-block">
          <h3>{fmt(t.remTitle, { n: openReminders.length })}</h3>
          {openReminders.length ? (
            <ul className="agent-secretary-list">
              {openReminders.map((r) => (
                <li key={r.id} className="agent-secretary-card">
                  <div className="agent-secretary-card-head">
                    <strong dir="auto">{r.task}</strong>
                    <span className={`agent-secretary-badge agent-priority-${r.priority}`}>
                      {priorityLabel(r.priority, t)}
                    </span>
                  </div>
                  <p className="muted">{fmt(t.before, { when: formatBeirut(r.dueDate, locale) })}</p>
                  <p className="agent-related-ids muted" dir="ltr">
                    {r.id}
                    {r.source ? ` · ${r.source}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t.noRems}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
