"use client";

import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import type { LiveBooking } from "@/lib/live/types";
import type { AuditStatus, MathQueryRecord } from "@/lib/solver/types";
import type { PublicUser } from "@/lib/auth/store";
import { subscriptionLabel } from "@/lib/auth/tiers";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import { fmt } from "@/lib/i18n/format";
import { adminMessages } from "@/lib/i18n/ns/admin";
import { liveMessages } from "@/lib/i18n/ns/live";

const TABS = ["overview", "audit", "queries", "live", "students", "whatsapp"] as const;
type Tab = (typeof TABS)[number];

type HardestTopic = { tag: string; count: number; down: number };

type Overview = {
  analytics: {
    students: number;
    activeSubscriptions: number;
    activations: number;
    byType: Record<string, number>;
    aiQueries: number;
    questionsToday: number;
    liveBookings: number;
    liveRequested: number;
    liveThisWeek: number;
    videoJobs: number;
    hardestTopics: HardestTopic[];
  };
  users: PublicUser[];
  entitlements: Array<{ id: string; studentName: string; planId: string; unlockedAt: string; phone?: string }>;
  queries: MathQueryRecord[];
  bookings: LiveBooking[];
  whatsapp?: WhatsAppMessage[];
};

export function AdminConsole({ initialTab = "overview" }: { initialTab?: Tab }) {
  const { locale } = useI18n();
  const t = adminMessages[locale].console;
  const statusText = liveMessages[locale].board.status;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as Overview;
      setData(payload);
      setLoadError(false);
      const next: Record<string, string> = {};
      for (const query of payload.queries ?? []) {
        next[query.id] = query.auditNote ?? "";
      }
      setNotes(next);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const patchBooking = async (id: string, status: LiveBooking["status"]) => {
    await fetch("/api/admin/live-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, meetingLink: meetingLink || undefined }),
    });
    setMeetingLink("");
    void load();
  };

  const audit = async (id: string, auditStatus: AuditStatus) => {
    await fetch("/api/admin/queries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, auditStatus, auditNote: notes[id] || "" }),
    });
    void load();
  };

  if (!data) {
    return loadError ? <ApiErrorBanner error={t.loadFailed} errorAr={t.loadFailed} /> : <SkeletonBlock lines={6} label={t.loading} />;
  }
  const a = data.analytics;

  return (
    <div className="admin-console">
      <div className="row admin-tabs">
        {TABS.map((item) => (
          <button key={item} type="button" className={tab === item ? "btn dark" : "btn"} onClick={() => setTab(item)}>
            {t.tabs[item]}
          </button>
        ))}
        <Link className="btn" href="/admin/video-generator">
          {t.heygen}
        </Link>
        <Link className="btn" href="/admin/audit">
          /admin/audit
        </Link>
      </div>

      {tab === "overview" ? (
        <div className="grid three" style={{ marginTop: 20 }}>
          <article className="card">
            <h3>{t.questionsToday}</h3>
            <p style={{ fontSize: 36 }}>{a.questionsToday}</p>
            <p className="muted">{fmt(t.queriesTotal, { n: a.aiQueries })}</p>
          </article>
          <article className="card">
            <h3>{t.liveWeek}</h3>
            <p style={{ fontSize: 36 }}>{a.liveThisWeek}</p>
            <p className="muted">{fmt(t.liveWaiting, { waiting: a.liveRequested, total: a.liveBookings })}</p>
          </article>
          <article className="card">
            <h3>{t.hardest}</h3>
            {a.hardestTopics?.length ? (
              <ul>
                {a.hardestTopics.map((topic) => (
                  <li key={topic.tag}>
                    {fmt(t.hardestRow, { tag: topic.tag, count: topic.count, down: topic.down })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t.noTagged}</p>
            )}
          </article>
          <article className="card">
            <h3>{t.activeSubs}</h3>
            <p style={{ fontSize: 36 }}>{a.activeSubscriptions}</p>
            <p className="muted">{fmt(t.accounts, { students: a.students, activations: a.activations })}</p>
          </article>
          <article className="card">
            <h3>{t.tiers}</h3>
            <p>{fmt(t.tiersRow, { ai: a.byType.AI_TIER ?? 0, live: a.byType.LIVE_TIER ?? 0, both: a.byType.BOTH ?? 0, none: a.byType.none ?? 0 })}</p>
          </article>
          <article className="card">
            <h3>{t.videoJobs}</h3>
            <p style={{ fontSize: 36 }}>{a.videoJobs}</p>
          </article>
        </div>
      ) : null}

      {tab === "audit" || tab === "queries" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>{tab === "audit" ? t.auditTitle : t.queriesTitle}</h2>
          <p className="muted">{t.auditLead}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.col.when}</th>
                <th>{t.col.student}</th>
                <th>{t.col.question}</th>
                <th>{t.col.answer}</th>
                <th>{t.col.tag}</th>
                <th>{t.col.rating}</th>
                <th>{t.col.audit}</th>
                <th>{t.col.image}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map((query) => (
                <tr key={query.id}>
                  <td>{query.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{query.userName}</td>
                  <td title={query.question}>{query.question.slice(0, 56)}</td>
                  <td title={query.finalAnswer}>{query.needsRetake ? t.needsRetake : query.finalAnswer.slice(0, 40)}</td>
                  <td>{query.topicTag || "—"}</td>
                  <td>{query.rating === 1 ? "👍" : query.rating === -1 ? "👎" : "—"}</td>
                  <td>
                    {t.auditStatus[query.auditStatus || "pending"]}
                    {query.auditNote ? ` · ${query.auditNote.slice(0, 24)}` : ""}
                  </td>
                  <td>
                    {query.imageUrl ? (
                      <a href={query.imageUrl} target="_blank" rel="noreferrer">
                        <img className="audit-thumb" src={query.imageUrl} alt="" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <input
                      className="audit-note"
                      placeholder={t.notesPh}
                      value={notes[query.id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [query.id]: event.target.value }))}
                    />
                    <button className="btn" type="button" onClick={() => void audit(query.id, "verified")}>
                      {t.verify}
                    </button>{" "}
                    <button className="btn warn" type="button" onClick={() => void audit(query.id, "needs_fix")}>
                      {t.needsFix}
                    </button>
                    <div>
                      <Link href={`/math-solver/result/${query.id}`}>{t.open}</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {tab === "live" ? (
        <div style={{ marginTop: 20 }}>
          <section className="card" style={{ overflowX: "auto", marginBottom: 20 }}>
            <h2>{t.liveManager}</h2>
            <label>
              {t.overrideLink}
              <input value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/…" />
            </label>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.col.when}</th>
                  <th>{t.col.student}</th>
                  <th>{t.col.phone}</th>
                  <th>{t.col.status}</th>
                  <th>{t.col.link}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.startsAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{booking.studentName}</td>
                    <td>{booking.studentPhone}</td>
                    <td>{statusText[booking.status] ?? booking.status}</td>
                    <td>
                      <a href={booking.classroomUrl || `/live/classroom/${encodeURIComponent(booking.id)}`}>
                        {t.join}
                      </a>
                      {booking.meetingProvider && booking.meetingProvider !== "livekit" && booking.meetingLink ? (
                        <>
                          {" · "}
                          <a href={booking.meetingLink} target="_blank" rel="noreferrer">
                            {booking.meetingProvider}
                          </a>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <button className="btn" type="button" onClick={() => void patchBooking(booking.id, "confirmed")}>
                        {t.confirm}
                      </button>{" "}
                      <button className="btn warn" type="button" onClick={() => void patchBooking(booking.id, "cancelled")}>
                        {t.cancel}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <LiveBookingBoard staff />
        </div>
      ) : null}

      {tab === "students" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>{t.studentAnalytics}</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.col.name}</th>
                <th>{t.col.email}</th>
                <th>{t.col.plan}</th>
                <th>{t.col.tier}</th>
                <th>{t.col.credits}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.entitlementPlanId ?? "—"}</td>
                  <td>{locale === "ar" ? subscriptionLabel(user.subscriptionType).ar : subscriptionLabel(user.subscriptionType).en}</td>
                  <td>{user.liveCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>{t.recentActivations}</h3>
          <ul>
            {data.entitlements.map((item) => (
              <li key={item.id}>
                {item.studentName} · {item.planId} · {item.unlockedAt.slice(0, 10)} · {item.phone}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "whatsapp" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>{t.outbox}</h2>
          <p className="muted">{t.outboxLead}</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.col.when}</th>
                <th>{t.col.to}</th>
                <th>{t.col.kind}</th>
                <th>{t.col.status}</th>
                <th>{t.col.body}</th>
              </tr>
            </thead>
            <tbody>
              {(data.whatsapp ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{item.to}</td>
                  <td>{item.kind}</td>
                  <td>
                    {item.status}/{item.provider}
                  </td>
                  <td>{item.body.slice(0, 80)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
