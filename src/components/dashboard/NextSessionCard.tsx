import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import type { OverviewSession } from "@/lib/dashboard/overview";
import { formatBeirut, formatBeirutTime } from "@/lib/format/dates";
import { WidgetEmpty } from "./WidgetStates";

const STATUS_AR: Record<OverviewSession["status"], string> = {
  requested: "بانتظار التأكيد",
  pending_payment: "بانتظار الدفع",
  confirmed: "مؤكّدة",
  cancelled: "ملغاة",
  completed: "منتهية",
};

export function NextSessionCard({ session }: { session: OverviewSession | null }) {
  if (!session) {
    return (
      <WidgetEmpty
        title="لا حصة محجوزة"
        body="احجز حصة فردية مع الأستاذ منذر في الوقت الذي يناسبك."
        action={
          <Link href="/live" className="btn dark">
            اعرض المواعيد
          </Link>
        }
      />
    );
  }
  return (
    <div className="mm-session">
      <div className="mm-session-date" aria-hidden="true">
        <strong>
          <Ltr>{formatBeirut(session.startsAt, { day: "numeric" })}</Ltr>
        </strong>
        <span>{formatBeirut(session.startsAt, { month: "long" })}</span>
      </div>
      <div className="mm-session-body">
        <strong>حصة مباشرة مع الأستاذ منذر حداره</strong>
        <span>
          {formatBeirut(session.startsAt, { weekday: "long" })} · <Ltr>{formatBeirutTime(session.startsAt)}</Ltr> بتوقيت
          بيروت · <Ltr>{session.durationMinutes}</Ltr> دقيقة
        </span>
        <span className={`mm-status s-${session.status}`}>{STATUS_AR[session.status]}</span>
      </div>
      <div className="mm-session-actions">
        {session.classroomUrl ? (
          <a href={session.classroomUrl} className="btn dark">
            <Icon name="video" size={18} /> دخول الصف
          </a>
        ) : null}
        <Link href="/live" className="ghost-btn ink">
          تفاصيل الحجز
        </Link>
      </div>
    </div>
  );
}
