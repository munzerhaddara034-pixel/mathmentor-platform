import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import { PendingSubscribeOrders } from "@/components/billing/PendingSubscribeOrders";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { dualLiveSessionPrices } from "@/lib/whish/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

const JOIN_NOTICES: Record<string, string> = {
  expired: "انتهت صلاحية رابط الدخول. اطلب رابطاً جديداً من الأستاذ عبر واتساب.",
  pending: "الحجز بانتظار تأكيد الدفع عبر Whish. يصلك رابط الدخول بعد التأكيد.",
  invalid: "رابط الدخول غير صالح. تأكّد من نسخه كاملاً أو اطلب رابطاً جديداً.",
  error: "تعذّر فتح الصف الآن. حاول مجدداً بعد قليل.",
};

export default async function LivePage({ searchParams }: { searchParams: Promise<{ join?: string }> }) {
  const { join } = await searchParams;
  const joinNotice = join ? JOIN_NOTICES[join] ?? JOIN_NOTICES.invalid : null;
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  const dual = dualLiveSessionPrices();
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">حصص فردية مباشرة · منذر أحمد حداره</p>
      <h1>حجز حصة مباشرة</h1>
      {joinNotice ? (
        <p className="error" role="alert">
          {joinNotice}
        </p>
      ) : null}
      <p className="muted">
        مشترك في المنصة <bdi dir="ltr">${dual.member.amount}</bdi> · من خارج المنصة <bdi dir="ltr">${dual.external.amount}</bdi>.
        الدفع عبر تحويل <bdi dir="ltr">Whish Money</bdi> باسم <strong>منذر أحمد حداره</strong> قبل تأكيد الحصة. للاشتراكات:{" "}
        <Link href="/subscribe">صفحة الاشتراك</Link>.
      </p>
      {staff ? <PendingSubscribeOrders staff /> : null}
      <LiveBookingBoard staff={Boolean(staff)} />
      {staff ? (
        <p className="muted" style={{ marginTop: 16 }}>
          للموظفين: الصف يستخدم <bdi dir="ltr">LiveKit Cloud</bdi>، وبدون مفاتيح تبقى الواجهة في وضع تجريبي.{" "}
          <a href="/live/classroom/demo">الحصة التجريبية</a>
        </p>
      ) : null}
    </main>
  );
}
