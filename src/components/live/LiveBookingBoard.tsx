"use client";

import { outsideSessionUsd, subscriberSessionUsd } from "@/lib/pricing/plans";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LiveBooking, LiveSlot, TeacherAvailability } from "@/lib/live/types";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import { useI18n } from "@/components/i18n/I18nProvider";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { liveMessages } from "@/lib/i18n/ns/live";
import { pickLang } from "@/lib/i18n/pick";

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

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
type Weekday = (typeof WEEKDAYS)[number];

function isWeekday(n: number): n is Weekday {
  return (WEEKDAYS as readonly number[]).includes(n);
}

function formatWhen(iso: string, locale: Locale) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(INTL_LOCALE[locale], {
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

/** Fallback before /api prices load: plans.ts (single price source; no env overrides). */
function envFallbackAmount(tier: PricingTier) {
  return tier === "member" ? subscriberSessionUsd() : outsideSessionUsd();
}

export function LiveBookingBoard({ staff = false }: { staff?: boolean }) {
  const { locale } = useI18n();
  const t = liveMessages[locale].board;
  const statusLabel = (status: LiveBooking["status"]) => t.status[status] ?? status;
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
  const [note, setNote] = useState<string>(t.defaultNote);
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
        setError(err instanceof Error ? err.message : t.loadFailed);
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
        setError(t.guestRequired);
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
        setError(pickLang(locale, payload.error, payload.errorAr) || t.bookFailed);
        return;
      }
      if (payload.transfer) setTransfer(payload.transfer);
      if (payload.price) setPrice(payload.price);
      if (payload.pricingTier) setPricingTier(payload.pricingTier);
      setMessage(
        `${pickLang(locale, payload.message, payload.messageAr) || t.ok}${
          payload.classroomUrl ? ` · ${payload.classroomUrl}` : payload.meetingLink ? ` · ${payload.meetingLink}` : ""
        }`.trim(),
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.bookFailed);
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
        setError(payload.error ?? t.payFailed);
        return;
      }
      setMessage(pickLang(locale, payload.message, payload.messageAr) || t.ok);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payFailed);
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
        setError(payload.error ?? t.saveHoursFailed);
        return;
      }
      setMessage(fmt(t.hoursSaved, { n: payload.slotCount ?? 0 }));
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
    : t.priceByTeacher;

  const weekLabel = useMemo(() => {
    if (!availability?.windows.length) return t.defaultHours;
    const names = availability.windows
      .map((item) => (isWeekday(item.weekday) ? t.weekdays[item.weekday] : String(item.weekday)))
      .join("/");
    return `${names} ${availability.windows[0].start}–${availability.windows[0].end} ${availability.timezone}`;
  }, [availability, t]);

  const pendingBookings = bookings.filter((booking) => booking.status === "pending_payment");
  const canBook = true; // Whish pay-per-session — members $15, guests $25; no credit gate

  return (
    <div className="live-board">
      <div className="card" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t.payEyebrow}</p>
        <h2 style={{ marginTop: 4 }}>{t.payTitle}</h2>
        <p className="muted">
          {fmt(t.summary, { credits, hours: weekLabel, name: locale === "ar" ? "منذر أحمد حداره" : "Munzer Ahmad Haddara" })}
        </p>
        <p style={{ fontSize: "1.05rem", marginTop: 8 }}>
          <strong>{fmt(t.prices, { member: memberAmount, external: externalAmount })}</strong>
        </p>
        <p>
          <strong>{t.yourPrice}</strong> <bdi dir="ltr">{priceLabel}</bdi>
          {checkoutTier === "member" ? ` · ${t.tierMember}` : ` · ${t.tierExternal}`}
        </p>
        {authenticated && hasPlatformPlan && !staff ? (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <input
              type="checkbox"
              checked={forceExternal}
              onChange={(event) => setForceExternal(event.target.checked)}
            />
            {fmt(t.bookAsExternal, { amount: externalAmount })}
          </label>
        ) : null}
        {needsGuestForm ? (
          <div className="grid two" style={{ marginTop: 12 }}>
            <label>
              {t.guestName}
              <input
                value={guestName}
                onChange={(event) => setGuestName(event.target.value)}
                placeholder={t.guestNamePh}
                autoComplete="name"
                required
              />
            </label>
            <label>
              {t.guestPhone}
              <input
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                placeholder="9617xxxxxxx"
                autoComplete="tel"
                required
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              {t.guestEmail}
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
            <p>
              <strong>{t.transferTo}</strong> <bdi dir="ltr">{transfer.phone}</bdi> —{" "}
              <strong>{locale === "ar" ? transfer.nameAr : transfer.nameEn}</strong>
            </p>
            <ul className="muted" style={{ paddingInlineStart: 18 }}>
              {(locale === "ar" ? transfer.linesAr : transfer.linesEn).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {loading ? <SkeletonBlock lines={4} label={t.loadingCalendar} /> : null}
      {busy ? <SkeletonBlock lines={2} label={t.updating} /> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      {pendingBookings.length > 0 ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{t.awaiting}</h3>
          {pendingBookings.map((booking) => (
            <div key={booking.id} style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <p>
                <strong>{formatWhen(booking.startsAt, locale)}</strong> · {booking.studentName}
                {booking.paymentAmount != null
                  ? ` · $${booking.paymentAmount} ${booking.pricingTier ? (booking.pricingTier === "member" ? t.tierMember : t.tierExternal) : ""}`
                  : ""}
                {booking.studentMarkedPaidAt ? ` · ${t.studentMarked}` : ""}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {authenticated && !staff ? (
                  <button className="btn dark" type="button" disabled={busy} onClick={() => void confirmPayment(booking.id, "student_mark")}>
                    {t.iTransferred}
                  </button>
                ) : null}
                {staff || authenticated ? (
                  <button className="btn dark" type="button" disabled={busy} onClick={() => void confirmPayment(booking.id, "teacher_confirm")}>
                    {staff ? t.confirmPayment : t.confirmAfter}
                  </button>
                ) : (
                  <p className="muted">{fmt(t.afterTransfer, { id: booking.id })}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {staff ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>{t.availability}</h3>
          <div className="weekday-row">
            {WEEKDAYS.map((day) => (
              <label key={day} className={days.includes(day) ? "chip" : "chip ghost-chip"}>
                <input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)} />
                {t.weekdays[day]}
              </label>
            ))}
          </div>
          <div className="grid two">
            <label>
              {t.start}
              <input type="time" value={startHour} onChange={(event) => setStartHour(event.target.value)} />
            </label>
            <label>
              {t.end}
              <input type="time" value={endHour} onChange={(event) => setEndHour(event.target.value)} />
            </label>
          </div>
          <label>
            {t.slotLength}
            <input type="number" min={30} max={90} value={duration} onChange={(event) => setDuration(Number(event.target.value) || 45)} />
          </label>
          <button className="btn dark" type="button" disabled={busy} onClick={() => void saveAvailability()}>
            {t.saveHours}
          </button>
          <h3 style={{ marginTop: 20 }}>{t.oneOff}</h3>
          <label>
            {t.startsAt}
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </label>
          <label>
            {t.note}
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn" type="button" disabled={busy} onClick={() => void addSlot()}>
            {t.addSlot}
          </button>
        </div>
      ) : null}

      <div className="grid two">
        <section className="card">
          <h2>{t.available}</h2>
          {slots.length === 0 ? <p className="muted">{t.noSlots}</p> : null}
          <ul className="slot-list">
            {slots.slice(0, staff ? 40 : 12).map((slot) => (
              <li key={slot.id}>
                <div>
                  <strong>{formatWhen(slot.startsAt, locale)}</strong>
                  <p className="muted">
                    {fmt(t.slotMeta, {
                      min: slot.durationMinutes,
                      note: slot.note || t.defaultNote,
                      price: checkoutPrice?.configured ? checkoutPrice.display : `$${checkoutTier === "member" ? memberAmount : externalAmount}`,
                    })}
                  </p>
                </div>
                <button className="btn dark" type="button" disabled={!canBook || busy} onClick={() => void book(slot.id)}>
                  {fmt(t.book, { price: `$${checkoutTier === "member" ? memberAmount : externalAmount}` })}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>{staff ? t.calendarAll : authenticated ? t.calendarMine : t.guestBookings}</h2>
          {bookings.length === 0 ? (
            <p className="muted">{authenticated ? t.none : t.signInToSee}</p>
          ) : null}
          <ul className="slot-list">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <div>
                  <strong>{formatWhen(booking.startsAt, locale)}</strong>
                  <p className="muted">
                    {statusLabel(booking.status)}
                    {booking.paymentStatus ? ` · ${t.paymentLabel}: ${t.paymentStatus[booking.paymentStatus] ?? booking.paymentStatus}` : ""}
                    {booking.paymentAmount != null ? ` · $${booking.paymentAmount}` : ""} · {booking.studentName}
                  </p>
                </div>
                {booking.status === "confirmed" ? (
                  <a className="btn dark" href={classroomHref(booking)}>
                    {t.join}
                  </a>
                ) : booking.status === "pending_payment" ? (
                  <span className="badge">{t.pendingWhish}</span>
                ) : (
                  <span className="badge">{statusLabel(booking.status)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
