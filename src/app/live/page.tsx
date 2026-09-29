import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import { PendingSubscribeOrders } from "@/components/billing/PendingSubscribeOrders";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { dualLiveSessionPrices } from "@/lib/whish/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const dual = dualLiveSessionPrices();
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">Live 1-on-1 · Munzer Ahmad Haddara · منذر أحمد حداره</p>
      <h1>حجز حصة مباشرة</h1>
      <p className="muted" dir="rtl">
        {dual.bannerAr}
      </p>
      <p className="muted">
        {dual.bannerEn}. Pay via Whish Money transfer to <strong>منذر أحمد حداره</strong> before
        confirmation. Subscriptions: <Link href="/subscribe">/subscribe</Link>. AI stays on{" "}
        <Link href="/math-solver">/math-solver</Link>.
      </p>
      {staff ? <PendingSubscribeOrders staff /> : null}
      <LiveBookingBoard staff={Boolean(staff)} />
      <p className="muted" style={{ marginTop: 16 }}>
        الصف يستخدم LiveKit Cloud. بدون مفاتيح تبقى الواجهة في وضع تجريبي.{" "}
        <a href="/live/classroom/demo">انضم للحصة التجريبية</a>
      </p>
    </main>
  );
}
