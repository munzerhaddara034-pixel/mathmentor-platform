"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon } from "@/components/ui/Icon";
import { TeacherSlotView } from "@/components/v2/TeacherSlot";
import type { OverviewSession } from "@/lib/dashboard/overview";
import { formatBeirut, formatBeirutTime, formatWhen } from "@/lib/format/dates";
import { fmt } from "@/lib/i18n/format";
import type { TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";
import { WidgetEmpty } from "./WidgetStates";

export function NextSessionCard({ session, teacherStatus }: { session: OverviewSession | null; teacherStatus: TeacherLiveStatus }) {
  const { locale, m } = useI18n();
  const t = m.dashboard;
  const words = { today: m.common.today, tomorrow: m.common.tomorrow };
  const offlineNote = session ? fmt(m.teacherSlot.nextSession, { when: formatWhen(session.startsAt, locale, words) }) : null;
  const slot = <TeacherSlotView status={teacherStatus} t={m.teacherSlot} variant="compact" offlineNote={offlineNote} />;
  if (!session) {
    return (
      <div className="v2-session">
        <div className="v2-session-media">{slot}</div>
        <WidgetEmpty
          title={t.nextEmpty}
          body={t.nextEmptyBody}
          action={
            <Link href="/live" className="v2-btn v2-btn-gold v2-btn-sm">
              {t.nextSee}
            </Link>
          }
        />
      </div>
    );
  }
  return (
    <div className="v2-session">
      <div className="v2-session-media">{slot}</div>
      <div className="mm-session-body">
        <strong>{t.nextWith}</strong>
        <span>
          {fmt(t.nextWhen, {
            weekday: formatBeirut(session.startsAt, { weekday: "long", day: "numeric", month: "long" }, locale),
            time: formatBeirutTime(session.startsAt, locale),
            n: session.durationMinutes,
          })}
        </span>
        <span className={`mm-status s-${session.status}`}>{t.status[session.status]}</span>
      </div>
      <div className="mm-session-actions">
        {session.classroomUrl ? (
          <a href={session.classroomUrl} className="v2-btn v2-btn-primary v2-btn-sm">
            <Icon name="video" size={18} /> {t.nextEnter}
          </a>
        ) : null}
        <Link href="/live" className="v2-btn v2-btn-glass v2-btn-sm">
          {t.nextDetails}
        </Link>
      </div>
    </div>
  );
}
