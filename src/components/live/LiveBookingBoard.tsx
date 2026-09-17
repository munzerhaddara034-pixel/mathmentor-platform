"use client";

import { useEffect, useMemo, useState } from "react";
import type { LiveBooking, LiveSlot, TeacherAvailability } from "@/lib/live/types";

const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 0, label: "Sun" },
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LiveBookingBoard({
  staff = false,
}: {
  staff?: boolean;
}) {
  const [slots, setSlots] = useState<LiveSlot[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [credits, setCredits] = useState<number>(0);
  const [availability, setAvailability] = useState<TeacherAvailability | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [note, setNote] = useState("1-on-1 with Prof. Munzer Haddara");
  const [days, setDays] = useState<number[]>([1, 3]);
  const [startHour, setStartHour] = useState("16:00");
  const [endHour, setEndHour] = useState("19:00");
  const [duration, setDuration] = useState(45);

  const load = () => {
    void fetch("/api/live/slots", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: {
        slots?: LiveSlot[];
        bookings?: LiveBooking[];
        liveCredits?: number;
        availability?: TeacherAvailability;
        error?: string;
      }) => {
        if (payload.error) setError(payload.error);
        setSlots(payload.slots ?? []);
        setBookings(payload.bookings ?? []);
        setCredits(payload.liveCredits ?? 0);
        if (payload.availability) {
          setAvailability(payload.availability);
          const windows = payload.availability.windows;
          if (windows.length) {
            setDays([...new Set(windows.map((item) => item.weekday))]);
            setStartHour(windows[0].start);
            setEndHour(windows[0].end);
            setDuration(payload.availability.durationMinutes);
          }
        }
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
    const payload = (await response.json()) as {
      error?: string;
      errorAr?: string;
      message?: string;
      messageAr?: string;
      meetingLink?: string;
    };
    if (!response.ok) {
      setError(`${payload.error ?? "Could not book."} ${payload.errorAr ?? ""}`);
      return;
    }
    setMessage(
      `${payload.message ?? "Booked."} ${payload.messageAr ?? ""}${payload.meetingLink ? ` · ${payload.meetingLink}` : ""}`,
    );
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

  const saveAvailability = async () => {
    setError("");
    setMessage("");
    const windows = days.map((weekday) => ({ weekday, start: startHour, end: endHour }));
    const response = await fetch("/api/live/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        timezone: "Asia/Beirut",
        windows,
        durationMinutes: duration,
        horizonDays: 21,
      }),
    });
    const payload = (await response.json()) as { error?: string; slotCount?: number };
    if (!response.ok) {
      setError(payload.error ?? "Could not save hours.");
      return;
    }
    setMessage(`Weekly hours saved. ${payload.slotCount ?? 0} open slots generated (Asia/Beirut).`);
    load();
  };

  const toggleDay = (n: number) => {
    setDays((current) => (current.includes(n) ? current.filter((item) => item !== n) : [...current, n].sort()));
  };

  const canBook = staff || credits > 0;
  const weekLabel = useMemo(() => {
    if (!availability?.windows.length) return "Mon/Wed 16:00–19:00 Asia/Beirut (default)";
    const names = availability.windows
      .map((item) => WEEKDAYS.find((d) => d.n === item.weekday)?.label || String(item.weekday))
      .join("/");
    return `${names} ${availability.windows[0].start}–${availability.windows[0].end} ${availability.timezone}`;
  }, [availability]);

  return (
    <div className="live-board">
      <p className="muted">
        Live credits: {credits}. Weekly hours: {weekLabel}. Each booking uses one credit with Prof. Munzer Haddara.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}
      {staff ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Teacher availability (Asia/Beirut)</h3>
          <div className="weekday-row">
            {WEEKDAYS.map((day) => (
              <label key={day.n} className={days.includes(day.n) ? "chip" : "chip ghost-chip"}>
                <input type="checkbox" checked={days.includes(day.n)} onChange={() => toggleDay(day.n)} />
                {day.label}
              </label>
            ))}
          </div>
          <div className="grid two">
            <label>
              Start
              <input type="time" value={startHour} onChange={(event) => setStartHour(event.target.value)} />
            </label>
            <label>
              End
              <input type="time" value={endHour} onChange={(event) => setEndHour(event.target.value)} />
            </label>
          </div>
          <label>
            Slot length (minutes)
            <input type="number" min={30} max={90} value={duration} onChange={(event) => setDuration(Number(event.target.value) || 45)} />
          </label>
          <button className="btn dark" type="button" onClick={() => void saveAvailability()}>
            Save weekly hours &amp; generate slots
          </button>
          <h3 style={{ marginTop: 20 }}>One-off slot</h3>
          <label>
            Starts at
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>
          <label>
            Note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={() => void addSlot()}>
            Add slot
          </button>
        </div>
      ) : null}
      <div className="grid two">
        <section className="card">
          <h2>Open slots</h2>
          {!canBook && !staff ? (
            <p className="muted">No live credits. Redeem a LIVE_TIER / BOTH card to book Prof. Munzer Haddara.</p>
          ) : null}
          {canBook && slots.length === 0 ? <p className="muted">No open slots.</p> : null}
          <ul className="slot-list">
            {(canBook ? slots : []).slice(0, staff ? 40 : 12).map((slot) => (
              <li key={slot.id}>
                <div>
                  <strong>{formatWhen(slot.startsAt)}</strong>
                  <p className="muted">
                    {slot.durationMinutes} min · {slot.note || "Prof. Munzer Haddara"} · Asia/Beirut
                  </p>
                </div>
                <button className="btn dark" type="button" disabled={!canBook} onClick={() => void book(slot.id)}>
                  Book
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>{staff ? "Calendar · all sessions" : "Your calendar"}</h2>
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
                          join
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
