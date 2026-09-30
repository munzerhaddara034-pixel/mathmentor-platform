import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import { PendingSubscribeOrders } from "@/components/billing/PendingSubscribeOrders";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { liveMessages } from "@/lib/i18n/ns/live";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";
import { dualLiveSessionPrices } from "@/lib/whish/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const JOIN_NOTICE_KEYS = {
  expired: "joinExpired",
  pending: "joinPending",
  invalid: "joinInvalid",
  error: "joinError",
} as const;

function isJoinKey(value: string): value is keyof typeof JOIN_NOTICE_KEYS {
  return Object.prototype.hasOwnProperty.call(JOIN_NOTICE_KEYS, value);
}

export default async function LivePage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  const { locale } = await getI18n();
  const t = liveMessages[locale].page;
  const joinNotice = join ? t[JOIN_NOTICE_KEYS[isJoinKey(join) ? join : "invalid"]] : null;
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const dual = dualLiveSessionPrices();
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      {joinNotice ? (
        <p className="error" role="alert">
          {joinNotice}
        </p>
      ) : null}
      <p className="muted">
        {rich(t.lead, {
          member: <bdi dir="ltr">${dual.member.amount}</bdi>,
          external: <bdi dir="ltr">${dual.external.amount}</bdi>,
          name: <strong>{locale === "ar" ? "منذر أحمد حداره" : "Munzer Ahmad Haddara"}</strong>,
          link: <Link href="/subscribe">{t.subscribeLink}</Link>,
        })}
      </p>
      {staff ? <PendingSubscribeOrders staff /> : null}
      <LiveBookingBoard staff={Boolean(staff)} />
      {staff ? (
        <p className="muted" style={{ marginTop: 16 }}>
          {t.staffNote} <a href="/live/classroom/demo">{t.demoRoom}</a>
        </p>
      ) : null}
    </main>
  );
}
