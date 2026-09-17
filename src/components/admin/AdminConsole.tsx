"use client";

import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import type { LiveBooking } from "@/lib/live/types";
import type { AuditStatus, MathQueryRecord } from "@/lib/solver/types";
import type { PublicUser } from "@/lib/auth/store";
import { subscriptionLabel } from "@/lib/auth/tiers";
import type { WhatsAppMessage } from "@/lib/whatsapp/types";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "overview" | "audit" | "queries" | "live" | "students" | "whatsapp";

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
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<Overview | null>(null);
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = () => {
    void fetch("/api/admin/overview", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: Overview) => {
        setData(payload);
        const next: Record<string, string> = {};
        for (const query of payload.queries ?? []) {
          next[query.id] = query.auditNote ?? "";
        }
        setNotes(next);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const patchBooking = async (id: string, status: LiveBooking["status"]) => {
    await fetch("/api/admin/live-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, meetingLink: meetingLink || undefined }),
    });
    setMeetingLink("");
    load();
  };

  const audit = async (id: string, auditStatus: AuditStatus) => {
    await fetch("/api/admin/queries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, auditStatus, auditNote: notes[id] || "" }),
    });
    load();
  };

  if (!data) return <p>Loading admin console…</p>;
  const a = data.analytics;

  return (
    <div className="admin-console">
      <div className="row admin-tabs">
        {(["overview", "audit", "queries", "live", "students", "whatsapp"] as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "btn dark" : "btn"} onClick={() => setTab(item)}>
            {item === "overview"
              ? "Overview"
              : item === "audit"
                ? "Teacher audit"
                : item === "queries"
                  ? "AI Query Logs"
                  : item === "live"
                    ? "Live Requests"
                    : item === "whatsapp"
                      ? "WhatsApp"
                      : "Students"}
          </button>
        ))}
        <Link className="btn" href="/admin/video-generator">
          HeyGen generator
        </Link>
        <Link className="btn" href="/admin/audit">
          /admin/audit
        </Link>
      </div>

      {tab === "overview" ? (
        <div className="grid three" style={{ marginTop: 20 }}>
          <article className="card">
            <h3>Questions answered today</h3>
            <p style={{ fontSize: 36 }}>{a.questionsToday}</p>
            <p className="muted">{a.aiQueries} queries total · Asia/Beirut</p>
          </article>
          <article className="card">
            <h3>Live sessions this week</h3>
            <p style={{ fontSize: 36 }}>{a.liveThisWeek}</p>
            <p className="muted">{a.liveRequested} waiting · {a.liveBookings} all-time</p>
          </article>
          <article className="card">
            <h3>Hardest topics</h3>
            {a.hardestTopics?.length ? (
              <ul>
                {a.hardestTopics.map((topic) => (
                  <li key={topic.tag}>
                    {topic.tag} · {topic.count} q · {topic.down} 👎
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No tagged queries yet.</p>
            )}
          </article>
          <article className="card">
            <h3>Active subscriptions</h3>
            <p style={{ fontSize: 36 }}>{a.activeSubscriptions}</p>
            <p className="muted">{a.students} student/parent accounts · {a.activations} card activations</p>
          </article>
          <article className="card">
            <h3>Tiers</h3>
            <p>AI {a.byType.AI_TIER} · Live {a.byType.LIVE_TIER} · Both {a.byType.BOTH} · none {a.byType.none}</p>
          </article>
          <article className="card">
            <h3>Video jobs</h3>
            <p style={{ fontSize: 36 }}>{a.videoJobs}</p>
          </article>
        </div>
      ) : null}

      {tab === "audit" || tab === "queries" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>{tab === "audit" ? "Teacher Audit & Oversight" : "AI Query Logs"}</h2>
          <p className="muted">Question, image, AI answer, student 👍/👎, one-click verify or mark needs fix.</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Student</th>
                <th>Q</th>
                <th>Answer</th>
                <th>Tag</th>
                <th>Rating</th>
                <th>Audit</th>
                <th>Image</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map((query) => (
                <tr key={query.id}>
                  <td>{query.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{query.userName}</td>
                  <td title={query.question}>{query.question.slice(0, 56)}</td>
                  <td title={query.finalAnswer}>{query.needsRetake ? "needs retake" : query.finalAnswer.slice(0, 40)}</td>
                  <td>{query.topicTag || "—"}</td>
                  <td>{query.rating === 1 ? "👍" : query.rating === -1 ? "👎" : "—"}</td>
                  <td>
                    {query.auditStatus || "pending"}
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
                      placeholder="Correction notes"
                      value={notes[query.id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [query.id]: event.target.value }))}
                    />
                    <button className="btn" type="button" onClick={() => void audit(query.id, "verified")}>
                      Verify
                    </button>{" "}
                    <button className="btn warn" type="button" onClick={() => void audit(query.id, "needs_fix")}>
                      Needs fix
                    </button>
                    <div>
                      <Link href={`/math-solver/result/${query.id}`}>open</Link>
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
            <h2>Live Session Manager</h2>
            <label>
              Override meeting link on confirm
              <input value={meetingLink} onChange={(event) => setMeetingLink(event.target.value)} placeholder="https://meet.google.com/…" />
            </label>
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Link</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.startsAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{booking.studentName}</td>
                    <td>{booking.studentPhone}</td>
                    <td>{booking.status}</td>
                    <td>
                      {booking.meetingLink ? (
                        <a href={booking.meetingLink} target="_blank" rel="noreferrer">
                          open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button className="btn" type="button" onClick={() => void patchBooking(booking.id, "confirmed")}>
                        Confirm
                      </button>{" "}
                      <button className="btn warn" type="button" onClick={() => void patchBooking(booking.id, "cancelled")}>
                        Cancel
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
          <h2>Student analytics</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Plan</th>
                <th>Tier</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.entitlementPlanId ?? "—"}</td>
                  <td>{subscriptionLabel(user.subscriptionType).ar}</td>
                  <td>{user.liveCredits}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Recent activations</h3>
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
          <h2>WhatsApp outbox</h2>
          <p className="muted">Without Twilio/UltraMsg keys, outbound messages are logged here so the demo still works.</p>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Kind</th>
                <th>Status</th>
                <th>Body</th>
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
