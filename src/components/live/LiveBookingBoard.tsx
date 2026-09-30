"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveBooking, LiveSlot, TeacherAvailability } from "@/lib/live/types";
import { SkeletonBlock } from "@/components/ui/Skeleton";

type PricingTier = "member" | "external";

type PriceInfo = {
  amount: number;
  currency: string;
  display: string;
  displayAr: string;
  configured: boolean;
  tier?: PricingTier;
};

type TransferInfo = {
  phone: string;
  nameAr: string;
  nameEn: string;
  linesEn: string[];
  linesAr: string[];
};

type PricesBundle = {
  member: PriceInfo;
  external: PriceInfo;
  bannerEn: string;
  bannerAr: string;
};

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
  return date.toLocaleString("ar-LB-u-nu-latn", {
    timeZone: "Asia/Beirut",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function classroomHref(booking: LiveBooking) {
  return booking.classroomUrl || `/live/classroom/${encodeURIComponent(booking.id)}`;
}

function envFallbackAmount(tier: PricingTier) {
  const key =
    tier === "member"
      ? "NEXT_PUBLIC_LIVE_SESSION_PRICE_USD"
      : "NEXT_PUBLIC_LIVE_SESSION_PRICE_EXTERNAL_USD";
  const raw = process.env[key];
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return tier === "member" ? 15 : 25;
}

export function LiveBookingBoard({ staff = false }: { staff?: boolean }) {
  const [slots, setSlots] = useState<LiveSlot[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [credits, setCredits] = useState(0);
  const [availability, setAvailability] = useState<TeacherAvailability | null>(null);
  const [price, setPrice] = useState<PriceInfo | null>(null);
  const [prices, setPrices] = useState<PricesBundle | null>(null);
  const [transfer, setTransfer] = useState<TransferInfo | null>(null);
  const [pricingTier, setPricingTier] = useState<PricingTier>("external");
  const [authenticated, setAuthenticated] = useState(false);
  const [hasLiveAccess, setHasLiveAccess] = useState(false);
  const [hasPlatformPlan, setHasPlatformPlan] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [note, setNote] = useState("1-on-1 with Munzer Ahmad Haddara");
  const [days, setDays] = useState<number[]>([1, 3]);
  const [startHour, setStartHour] = useState("16:00");
  const [endHour, setEndHour] = useState("19:00");
  const [duration, setDuration] = useState(45);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [forceExternal, setForceExternal] = useState(false);

  const isMemberCheckout = !forceExternal && (staff || (authenticated && (hasLiveAccess || hasPlatformPlan)));
  const checkoutTier: PricingTier = isMemberCheckout ? "member" : "external";
  const needsGuestForm = !staff && checkoutTier === "external";

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/live/slots", { credentials: "same-origin" })
      .then(async (response) => {
        const payload = (await response.json()) as {
          slots?: LiveSlot[];
          bookings?: LiveBooking[];
          liveCredits?: number;
          availability?: TeacherAvailability;
          price?: PriceInfo;
          prices?: PricesBundle;
          transfer?: TransferInfo;
          transferMember?: TransferInfo;
          transferExternal?: TransferInfo;
          pricingTier?: PricingTier;
          authenticated?: boolean;
          hasLiveAccess?: boolean;
          hasPlatformPlan?: boolean;
          error?: string;
        };
        if (payload.error) setError(payload.error);
        setSlots(payload.slots ?? []);
        setBookings(payload.bookings ?? []);
        setCredits(payload.liveCredits ?? 0);
        setAuthenticated(Boolean(payload.authenticated));
        setHasLiveAccess(Boolean(payload.hasLiveAccess));
        setHasPlatformPlan(Boolean(payload.hasPlatformPlan));
        if (payload.pricingTier) setPricingTier(payload.pricingTier);
        if (payload.prices) setPrices(payload.prices);
        if (payload.price) setPrice(payload.price);
        if (payload.transfer) setTransfer(payload.transfer);
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
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!prices) return;
    const next = prices[checkoutTier];
    setPrice(next);
    setPricingTier(checkoutTier);
  }, [checkoutTier, prices]);

  const book = async (slotId: string) => {
    setError("");
    setMessage("");
    if (needsGuestForm) {
      if (!guestName.trim() || !guestPhone.trim()) {
        setError("Name and phone are required for outside-platform booking. · الاسم والهاتف مطلوبان.");
        return;
      }
    }
    setBusy(true);
    try {
      const body: {
        slotId: string;
        pricingTier?: PricingTier;
        guest?: { name: string; phone: string; email?: string };
      } = { slotId, pricingTier: checkoutTier };
      if (needsGuestForm) {
        body.guest = {
          name: guestName.trim(),
          phone: guestPhone.trim(),
          email: guestEmail.trim() || undefined,
        };
      }
      const response = await fetch("/api/live/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: string;
        errorAr?: string;
        message?: string;
        messageAr?: string;
        pendingPayment?: boolean;
        transfer?: TransferInfo;
        price?: PriceInfo;
        pricingTier?: PricingTier;
        classroomUrl?: string;
        meetingLink?: string;
      };
      if (!response.ok) {
        setError(`${payload.error ?? "Could not book."} ${payload.errorAr ?? ""}`);
        return;
      }
      if (payload.transfer) setTransfer(payload.transfer);
      if (payload.price) setPrice(payload.price);
      if (payload.pricingTier) setPricingTier(payload.pricingTier);
      setMessage(
        `${payload.message ?? "OK."} ${payload.messageAr ?? ""}${
          payload.classroomUrl ? ` · ${payload.classroomUrl}` : payload.meetingLink ? ` · ${payload.meetingLink}` : ""
        }`.trim(),
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async (bookingId: string, action: "student_mark" | "teacher_confirm") => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/live/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ bookingId, action }),
      });
      const payload = (await response.json()) as { error?: string; message?: string; messageAr?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not update payment.");
        return;
      }
      setMessage(`${payload.message ?? "Updated."} ${payload.messageAr ?? ""}`.trim());
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment update failed.");
    } finally {
      setBusy(false);
    }
  };

  const addSlot = async () => {
    if (!startsAt) return;
    setBusy(true);
    try {
      await fetch("/api/live/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), note }),
      });
      setStartsAt("");
      load();
    } finally {
      setBusy(false);
    }
  };

  const saveAvailability = async () => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
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
      setMessage(`Weekly hours saved. ${payload.slotCount ?? 0} open slots (Asia/Beirut).`);
      load();
    } finally {
      setBusy(false);
    }
  };

  const toggleDay = (n: number) => {
    setDays((current) => (current.includes(n) ? current.filter((item) => item !== n) : [...current, n].sort((a, b) => a - b)));
  };

  const memberAmount = prices?.member.amount ?? envFallbackAmount("member");
  const externalAmount = prices?.external.amount ?? envFallbackAmount("external");
  const checkoutPrice = price ?? prices?.[checkoutTier] ?? null;
  const priceLabel = checkoutPrice?.configured
    ? checkoutPrice.display
    : "السعر يحدده الأستاذ · Price set by the teacher";

  const weekLabel = useMemo(() => {
    if (!availability?.windows.length) return "Mon/Wed 16:00–19:00 Asia/Beirut (default)";
    const names = availability.windows
      .map((item) => WEEKDAYS.find((d) => d.n === item.weekday)?.label || String(item.weekday))
      .join("/");
    return `${names} ${availability.windows[0].start}–${availability.windows[0].end} ${availability.timezone}`;
  }, [availability]);

  const pendingBookings = bookings.filter((booking) => booking.status === "pending_payment");
  const canBook = true; // Whish pay-per-session — members $15, guests $25; no credit gate

  return (
    <div className="live-board">
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">Whish Money · منذر أحمد حداره</p>
        <h2 style={{ marginTop: 4 }}>دفع الحصة / Session payment</h2>
        <p className="muted">
          Live credits: {credits}. Hours: {weekLabel}. Instructor: <strong>Munzer Ahmad Haddara</strong>.
        </p>
        <p dir="rtl" style={{ fontSize: "1.05rem", marginTop: 8 }}>
          <strong>مشترك المنصة ${memberAmount} · خارج المنصة ${externalAmount}</strong>
        </p>
        <p className="muted">
          Platform member ${memberAmount} · Outside platform ${externalAmount}
        </p>
        <p>
          <strong>Your checkout / سعرك:</strong> {priceLabel}
          {checkoutTier === "member" ? " · member" : " · external"}
        </p>
        {authenticated && hasPlatformPlan && !staff ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={forceExternal}
              onChange={(event) => setForceExternal(event.target.checked)}
            />
            Book as outside platform (${externalAmount}) / احجز كخارج المنصة
          </label>
        ) : null}
        {needsGuestForm ? (
          <div className="grid two" style={{ marginTop: 12 }}>
            <label>
              الاسم / Name *
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder="اسم الطالب"
                autoComplete="name"
                required
              />
            </label>
            <label>
              الهاتف / Phone * (WhatsApp)
              <input
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="9617xxxxxxx"
                autoComplete="tel"
                required
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              البريد / Email (optional)
              <input
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                placeholder="optional@email.com"
                autoComplete="email"
              />
            </label>
          </div>
        ) : null}
        {transfer ? (
          <div style={{ marginTop: 10 }}>
            <p dir="rtl">
              <strong>حوّل عبر Whish إلى:</strong> {transfer.phone} — <strong>{transfer.nameAr}</strong>
            </p>
            <p>
              <strong>Transfer via Whish to:</strong> {transfer.phone} — {transfer.nameEn}
            </p>
            <ul className="muted" dir="rtl" style={{ paddingInlineStart: 18 }}>
              {transfer.linesAr.map((line) => (
                <li key={`ar-${line}`}>{line}</li>
              ))}
            </ul>
            <ul className="muted" style={{ paddingInlineStart: 18 }}>
              {transfer.linesEn.map((line) => (
                <li key={`en-${line}`}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {loading ? <SkeletonBlock lines={4} label="Loading live calendar" /> : null}
      {busy ? <SkeletonBlock lines={2} label="Updating booking" /> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {pendingBookings.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>بانتظار تحويل Whish / Awaiting Whish</h3>
          {pendingBookings.map((booking) => (
            <div key={booking.id} style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <p>
                <strong>{formatWhen(booking.startsAt)}</strong> · {booking.studentName}
                {booking.paymentAmount != null
                  ? ` · $${booking.paymentAmount} ${booking.pricingTier ?? ""}`
                  : ""}
                {booking.studentMarkedPaidAt ? " · student marked transferred" : ""}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {authenticated && !staff ? (
                  <button className="btn dark" type="button" disabled={busy} onClick={() => void confirmPayment(booking.id, "student_mark")}>
                    لقد حوّلت / I&apos;ve transferred
                  </button>
                ) : null}
                {staff || authenticated ? (
                  <button className="btn dark" type="button" disabled={busy} onClick={() => void confirmPayment(booking.id, "teacher_confirm")}>
                    {staff ? "تأكيد الدفع / Confirm payment" : "تأكيد بعد التحويل / Confirm after transfer"}
                  </button>
                ) : (
                  <p className="muted" dir="rtl">
                    بعد التحويل سيؤكّد الأستاذ الدفع عبر واتساب. احفظ رقم الحجز: {booking.id}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

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
          <button className="btn dark" type="button" disabled={busy} onClick={() => void saveAvailability()}>
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
          <button className="btn" type="button" disabled={busy} onClick={() => void addSlot()}>
            Add slot
          </button>
        </div>
      ) : null}

      <div className="grid two">
        <section className="card">
          <h2>المواعيد المتاحة</h2>
          {slots.length === 0 ? <p className="muted">لا مواعيد متاحة حالياً. عُد لاحقاً أو راسلنا عبر المساعد.</p> : null}
          <ul className="slot-list">
            {slots.slice(0, staff ? 40 : 12).map((slot) => (
              <li key={slot.id}>
                <div>
                  <strong>{formatWhen(slot.startsAt)}</strong>
                  <p className="muted">
                    <bdi dir="ltr">{slot.durationMinutes}</bdi> دقيقة · {slot.note || "منذر أحمد حداره"} · بتوقيت بيروت ·{" "}
                    <bdi dir="ltr">
                      {checkoutPrice?.configured ? checkoutPrice.display : `$${checkoutTier === "member" ? memberAmount : externalAmount}`}
                    </bdi>
                  </p>
                </div>
                <button className="btn dark" type="button" disabled={!canBook || busy} onClick={() => void book(slot.id)}>
                  احجز · <bdi dir="ltr">${checkoutTier === "member" ? memberAmount : externalAmount}</bdi>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>{staff ? "Calendar · all sessions" : authenticated ? "Your calendar" : "Guest bookings"}</h2>
          {bookings.length === 0 ? (
            <p className="muted">{authenticated ? "None yet." : "Sign in to see past bookings, or book below as a guest."}</p>
          ) : null}
          <ul className="slot-list">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <div>
                  <strong>{formatWhen(booking.startsAt)}</strong>
                  <p className="muted">
                    {booking.status}
                    {booking.paymentStatus ? ` · pay:${booking.paymentStatus}` : ""}
                    {booking.paymentAmount != null ? ` · $${booking.paymentAmount}` : ""} · {booking.studentName}
                  </p>
                </div>
                {booking.status === "confirmed" ? (
                  <a className="btn dark" href={classroomHref(booking)}>
                    انضم للحصة
                  </a>
                ) : booking.status === "pending_payment" ? (
                  <span className="badge">pending Whish</span>
                ) : (
                  <span className="badge">{booking.status}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
