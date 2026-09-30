import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { DashboardReminder } from "@/lib/auth/dashboard";
import { formatBeirutDate } from "@/lib/format/dates";
import type { Locale } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { pickTitle } from "@/lib/i18n/pick";

export function daysLabel(days: number, t: Messages["dashboard"]): string {
  if (days === 0) return t.today;
  if (days === 1) return t.tomorrow;
  return fmt(t.inDays, { days: fmt(plural(days, t.days), { n: days }) });
}

export function ExamReminder({ reminder, m, locale }: { reminder: DashboardReminder; m: Messages; locale: Locale }) {
  return (
    <div className="mm-reminder">
      <span className="v2-ico g" aria-hidden="true">
        <Icon name="exam" size={20} />
      </span>
      <div>
        <strong>{pickTitle(locale, reminder)}</strong>
        <span>
          {formatBeirutDate(reminder.dueAt, locale)} · {daysLabel(reminder.daysLeft, m.dashboard)}
        </span>
      </div>
      {reminder.href ? (
        <Link href={reminder.href} className="mm-link">
          {m.dashboard.prepare}
        </Link>
      ) : null}
    </div>
  );
}

export function RemindersList({ reminders, m, locale }: { reminders: DashboardReminder[]; m: Messages; locale: Locale }) {
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-reminders">
      <div className="mm-widget-head">
        <h2 id="mm-reminders">{m.dashboard.remindersTitle}</h2>
      </div>
      <ul className="mm-reminder-list">
        {reminders.map((item) => (
          <li key={item.id}>
            <ExamReminder reminder={item} m={m} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
