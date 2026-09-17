"use client";

import { useEffect, useState } from "react";
import type { LiveBooking, LiveSlot } from "@/lib/live/types";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LiveBookingBoard({
  staff = false,
}: {
  staff?: boolean;
}) {
  const [slots, setSlots] = useState<LiveSlot[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [note, setNote] = useState("1-on-1 with Prof. Munzer Haddara");

  const load = () => {
    void fetch("/api/live/slots", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { slots?: LiveSlot[]; bookings?: LiveBooking[]; liveCredits?: number; error?: string }) => {
        if (payload.error) setError(payload.error);
        setSlots(payload.slots ?? []);
        setBookings(payload.bookings ?? []);
        setCredits(payload.liveCredits ?? 0);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const book = async (slotId: string) => {
    setError("");
    setMessage("");
    const response = await fetch("/api/live/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ slotId }),
    });
    const payload = (await response.json()) as { error?: string; errorAr?: string; message?: string; messageAr?: string };
    if (!response.ok) {
      setError(`${payload.error ?? "Could not book."} ${payload.errorAr ?? ""}`);
      return;
    }
    setMessage(`${payload.message ?? "Booked."} ${payload.messageAr ?? ""}`);
    load();
  };

  const addSlot = async () => {
    if (!startsAt) return;
    await fetch("/api/live/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), note }),
    });
    setStartsAt("");
    load();
  };

  return (
    <div className="live-board">
      <p className="muted">Live credits: {credits}. Each confirmed request uses one credit with Prof. Munzer Haddara.</p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
      {staff ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Add availability</h3>
          <label>
            Starts at
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>
          <label>
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn dark" type="button" onClick={() => void addSlot()}>
            Add slot
          </button>
        </div>
      ) : null}
      <div className="grid two">
        <section className="card">
          <h2>Open slots</h2>
          {slots.length === 0 ? <p className="muted">No open slots.</p> : null}
          <ul className="slot-list">
            {slots.map((slot) => (
              <li key={slot.id}>
                <div>
                  <strong>{formatWhen(slot.startsAt)}</strong>
                  <p className="muted">
                    {slot.durationMinutes} min · {slot.note || "Prof. Munzer Haddara"}
                  </p>
                </div>
                <button className="btn dark" type="button" onClick={() => void book(slot.id)}>
                  Book
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>{staff ? "All requests" : "Your sessions"}</h2>
          {bookings.length === 0 ? <p className="muted">None yet.</p> : null}
          <ul className="slot-list">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <div>
                  <strong>{formatWhen(booking.startsAt)}</strong>
                  <p className="muted">
                    {booking.status} · {booking.studentName}
                    {booking.meetingLink ? (
                      <>
                        {" · "}
                        <a href={booking.meetingLink} target="_blank" rel="noreferrer">
                          meeting
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
                <span className={`badge ${booking.status === "confirmed" ? "approved" : booking.status === "cancelled" ? "rejected" : "pending"}`}>
                  {booking.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
