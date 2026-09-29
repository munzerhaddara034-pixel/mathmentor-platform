"use client";

import { useMemo, useState } from "react";
import { AGENT_ROLES_AR } from "@/lib/agent/persona";

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

function formatBeirut(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-LB", {
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

function priorityLabel(p: string): string {
  if (p === "high") return "عالية";
  if (p === "low") return "منخفضة";
  return "متوسطة";
}

function statusLabelAppt(s: string): string {
  if (s === "scheduled") return "مجدول";
  if (s === "pending") return "قيد الانتظار";
  if (s === "completed") return "مكتمل";
  if (s === "cancelled") return "ملغى";
  return s;
}

type Props = {
  appointments?: SecretaryAppointmentRow[];
  reminders?: SecretaryReminderRow[];
};

export function SecretarySchedule({ appointments = [], reminders = [] }: Props) {
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
      <h2 dir="rtl" lang="ar">
        سكرتير محمد · جدول المواعيد والمهام اليومية · Secretary Schedule
      </h2>
      <p className="muted" dir="rtl" lang="ar">
        محمد: {AGENT_ROLES_AR.join(" · ")}.
      </p>
      <p className="muted" dir="rtl" lang="ar">
        محمد يفهم العامية اللبنانية والفصحى — يتواصل مع المساعد التشغيلي من قبل الأستاذ منذر ويتابع المواعيد والتذكيرات من واتساب / الصوت — توقيت آسيا/بيروت.
      </p>

      <div className="agent-secretary-filters" role="toolbar" aria-label="تصفية الجدول">
        <div className="agent-actions" dir="rtl" lang="ar">
          {(
            [
              ["today", "اليوم"],
              ["upcoming", "قادم"],
              ["all", "الكل"],
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
        <div className="agent-actions" dir="rtl" lang="ar">
          {(
            [
              ["all", "الكل"],
              ["appointments", "مواعيد"],
              ["reminders", "تذكيرات"],
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
          <h3 dir="rtl" lang="ar">
            🗓️ مواعيد محمد ({pendingAppts.length})
          </h3>
          {pendingAppts.length ? (
            <ul className="agent-secretary-list">
              {pendingAppts.map((a) => (
                <li key={a.id} className="agent-secretary-card">
                  <div className="agent-secretary-card-head">
                    <strong dir="rtl" lang="ar">
                      {a.title}
                    </strong>
                    <span className="agent-secretary-badge">{statusLabelAppt(a.status)}</span>
                  </div>
                  <p className="muted" dir="rtl" lang="ar">
                    {formatBeirut(a.dateTime)}
                    {a.contactPerson ? ` · ${a.contactPerson}` : ""}
                  </p>
                  {a.notes ? (
                    <p className="muted" dir="rtl" lang="ar">
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
            <p className="muted" dir="rtl" lang="ar">
              لا مواعيد في هذا الفلتر — جرّب واتساب: «سجّل موعد غداً الساعة ١٠ مع الأستاذ أحمد».
            </p>
          )}
        </div>
      ) : null}

      {showRems ? (
        <div className="agent-secretary-block">
          <h3 dir="rtl" lang="ar">
            ✅ تذكيرات محمد ({openReminders.length})
          </h3>
          {openReminders.length ? (
            <ul className="agent-secretary-list">
              {openReminders.map((r) => (
                <li key={r.id} className="agent-secretary-card">
                  <div className="agent-secretary-card-head">
                    <strong dir="rtl" lang="ar">
                      {r.task}
                    </strong>
                    <span className={`agent-secretary-badge agent-priority-${r.priority}`}>
                      {priorityLabel(r.priority)}
                    </span>
                  </div>
                  <p className="muted" dir="rtl" lang="ar">
                    قبل {formatBeirut(r.dueDate)}
                  </p>
                  <p className="agent-related-ids muted" dir="ltr">
                    {r.id}
                    {r.source ? ` · ${r.source}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" dir="rtl" lang="ar">
              لا تذكيرات مفتوحة — جرّب: «ذكّرني غداً بمراجعة امتحان الباريم».
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
