"use client";

import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import type { LiveBooking } from "@/lib/live/types";
import type { MathQueryRecord } from "@/lib/solver/types";
import type { PublicUser } from "@/lib/auth/store";
import { subscriptionLabel } from "@/lib/auth/tiers";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "overview" | "queries" | "live" | "students";

type Overview = {
  analytics: {
    students: number;
    activeSubscriptions: number;
    activations: number;
    byType: Record<string, number>;
    aiQueries: number;
    liveBookings: number;
    liveRequested: number;
    videoJobs: number;
  };
  users: PublicUser[];
  entitlements: Array<{ id: string; studentName: string; planId: string; unlockedAt: string; phone?: string }>;
  queries: MathQueryRecord[];
  bookings: LiveBooking[];
};

export function AdminConsole() {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [meetingLink, setMeetingLink] = useState("");

  const load = () => {
    void fetch("/api/admin/overview", { credentials: "same-origin" })
      .then((response) => response.json())
      .then(setData);
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

  if (!data) return <p>Loading admin console…</p>;
  const a = data.analytics;

  return (
    <div className="admin-console">
      <div className="row admin-tabs">
        {(["overview", "queries", "live", "students"] as Tab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? "btn dark" : "btn"} onClick={() => setTab(item)}>
            {item === "overview"
              ? "Overview"
              : item === "queries"
                ? "AI Query Logs"
                : item === "live"
                  ? "Live Requests"
                  : "Students"}
          </button>
        ))}
        <Link className="btn" href="/admin/video-generator">
          HeyGen generator
        </Link>
      </div>

      {tab === "overview" ? (
        <div className="grid three" style={{ marginTop: 20 }}>
          <article className="card">
            <h3>Active subscriptions</h3>
            <p style={{ fontSize: 36 }}>{a.activeSubscriptions}</p>
            <p className="muted">{a.students} student/parent accounts · {a.activations} card activations</p>
          </article>
          <article className="card">
            <h3>AI queries</h3>
            <p style={{ fontSize: 36 }}>{a.aiQueries}</p>
            <p className="muted">{a.videoJobs} HeyGen/demo jobs</p>
          </article>
          <article className="card">
            <h3>Live requests</h3>
            <p style={{ fontSize: 36 }}>{a.liveRequested}</p>
            <p className="muted">{a.liveBookings} bookings total</p>
          </article>
          <article className="card">
            <h3>Tiers</h3>
            <p>AI {a.byType.AI_TIER} · Live {a.byType.LIVE_TIER} · Both {a.byType.BOTH} · none {a.byType.none}</p>
          </article>
        </div>
      ) : null}

      {tab === "queries" ? (
        <section className="card" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2>AI Query Logs</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Student</th>
                <th>Question</th>
                <th>Answer</th>
                <th>Source</th>
                <th>Video</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map((query) => (
                <tr key={query.id}>
                  <td>{query.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{query.userName}</td>
                  <td>{query.question.slice(0, 72)}</td>
                  <td>{query.finalAnswer.slice(0, 48)}</td>
                  <td>{query.source}</td>
                  <td>
                    {query.videoStatus}
                    {query.heygenJobId ? ` · ${query.heygenJobId.slice(0, 10)}` : ""}
                  </td>
                  <td>{query.imageUrl ? <a href={query.imageUrl}>ref</a> : "—"}</td>
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
              Meeting link for confirm
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
    </div>
  );
}
