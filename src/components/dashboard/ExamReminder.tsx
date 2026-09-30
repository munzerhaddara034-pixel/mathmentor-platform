import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import type { DashboardReminder } from "@/lib/auth/dashboard";
import { formatBeirutDate } from "@/lib/format/dates";

function daysLabel(days: number) {
  if (days === 0) return "اليوم";
  if (days === 1) return "غداً";
  return (
    <>
      بعد <Ltr>{days}</Ltr> {days <= 10 ? "أيام" : "يوماً"}
    </>
  );
}

export function ExamReminder({ reminder }: { reminder: DashboardReminder }) {
  return (
    <div className="mm-reminder">
      <span className="mm-tile-icon tone-gold" aria-hidden="true">
        <Icon name="exam" size={22} />
      </span>
      <div>
        <strong>{reminder.arabicTitle || reminder.title}</strong>
        <span>
          {formatBeirutDate(reminder.dueAt)} · {daysLabel(reminder.daysLeft)}
        </span>
      </div>
      {reminder.href ? (
        <Link href={reminder.href} className="mm-link">
          استعدّ
        </Link>
      ) : null}
    </div>
  );
}

export function RemindersList({ reminders }: { reminders: DashboardReminder[] }) {
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-reminders">
      <div className="mm-widget-head">
        <h2 id="mm-reminders">مواعيد قادمة</h2>
      </div>
      <ul className="mm-reminder-list">
        {reminders.map((item) => (
          <li key={item.id}>
            <ExamReminder reminder={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}
