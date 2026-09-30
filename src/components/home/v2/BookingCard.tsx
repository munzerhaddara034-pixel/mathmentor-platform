import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/Icon";
import { TeacherSlot } from "@/components/v2/TeacherSlotServer";
import { formatWhen, formatWhenParts } from "@/lib/format/dates";
import { fmt } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";
import { availableSlots } from "@/lib/live/store";
import type { LiveSlot } from "@/lib/live/types";

type Prices = { member: number; guest: number };

/** Live 1:1 booking card: teacher slot + next real open times + real prices (Whish). */
export function BookingCard({ m, locale, prices, whishNumber }: { m: Messages; locale: Locale; prices: Prices; whishNumber: string }) {
  const t = m.home;
  return (
    <section className="v2-booking glass" aria-labelledby="v2-booking-title">
      <Suspense fallback={<BookingSkeleton label={m.common.loading} />}>
        <BookingLive m={m} locale={locale} />
      </Suspense>
      <div className="v2-booking-body">
        <div className="v2-sec-title">
          <h2 id="v2-booking-title">{t.bookingTitle}</h2>
          <Link href="/live">{t.allTimes}</Link>
        </div>
        <dl className="v2-prices">
          <div>
            <dt>{t.priceMember}</dt>
            <dd className="ltr">${prices.member}</dd>
          </div>
          <div>
            <dt>{t.priceGuest}</dt>
            <dd className="ltr">${prices.guest}</dd>
          </div>
        </dl>
        <p className="v2-paynote">{rich(t.payNote, whishNumber)}</p>
        <Link href="/live" className="v2-btn v2-btn-gold v2-btn-block">
          <Icon name="calendar" size={18} /> {t.ctaBook}
        </Link>
      </div>
    </section>
  );
}

function rich(template: string, phone: string) {
  const [before, after = ""] = template.split("{phone}");
  return (
    <>
      {before}
      <bdi dir="ltr">+{phone.replace(/^(\d{3})(\d{2})(\d{3})(\d{3})$/, "$1 $2 $3 $4")}</bdi>
      {after}
    </>
  );
}

async function loadSlots(): Promise<LiveSlot[] | null> {
  try {
    return (await availableSlots()).slice(0, 3);
  } catch {
    return null;
  }
}

async function BookingLive({ m, locale }: { m: Messages; locale: Locale }) {
  const slots = await loadSlots();
  const words = { today: m.common.today, tomorrow: m.common.tomorrow };
  const next = slots?.[0];
  const offlineNote = next ? fmt(m.teacherSlot.nextSlot, { when: formatWhen(next.startsAt, locale, words) }) : null;
  return (
    <div className="v2-booking-media">
      <TeacherSlot t={m.teacherSlot} offlineNote={offlineNote} />
      <div>
        <h3 className="v2-booking-sub">{m.home.slotsTitle}</h3>
        {slots === null ? (
          <p className="v2-muted" role="status">
            {m.home.slotsError}
          </p>
        ) : slots.length === 0 ? (
          <p className="v2-muted">{m.home.slotsEmpty}</p>
        ) : (
          <ul className="v2-slots">
            {slots.map((slot) => {
              const when = formatWhenParts(slot.startsAt, locale, words);
              return (
                <li key={slot.id}>
                  <Link href="/live" className="v2-slot">
                    <small>{when.day}</small>
                    <b className="ltr">{when.time}</b>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {next ? <p className="v2-muted v2-small">{fmt(m.home.sessionBlurb, { n: next.durationMinutes })}</p> : null}
      </div>
    </div>
  );
}

function BookingSkeleton({ label }: { label: string }) {
  return (
    <div className="v2-booking-media" aria-busy="true" aria-label={label}>
      <div className="v2-tslot v2-skel" />
      <div className="v2-slots">
        <span className="v2-skel v2-skel-slot" />
        <span className="v2-skel v2-skel-slot" />
        <span className="v2-skel v2-skel-slot" />
      </div>
    </div>
  );
}
