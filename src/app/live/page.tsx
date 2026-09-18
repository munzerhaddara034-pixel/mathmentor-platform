import { LiveBookingBoard } from "@/components/live/LiveBookingBoard";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LivePage() {
  const live = await getLiveSession();
  const staff = live.ok && isStaffRole(live.user.role);
  return (
    <main className="shell">
      <p className="eyebrow">Live 1-on-1 · Prof. Munzer Haddara</p>
      <h1>حجز حصة مباشرة</h1>
      <p className="muted">
        Tier 2: book a 45-minute session with <strong>الأستاذ منذر حداره</strong>. AI explanations stay on{" "}
        <Link href="/math-solver">/math-solver</Link>; live hours are for the problems that still need a human board.
      </p>
      <LiveBookingBoard staff={Boolean(staff)} />
      <p className="muted" style={{ marginTop: 16 }}>
        الصف يستخدم LiveKit Cloud: السبورة الرياضية + الفيديو. بدون مفاتيح LiveKit تبقى الواجهة تعمل في وضع تجريبي.{" "}
        <a href="/live/classroom/demo">انضم للحصة التجريبية</a>
      </p>
    </main>
  );
}
