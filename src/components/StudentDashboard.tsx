import { ContinueLesson } from "@/components/dashboard/ContinueLesson";
import { CoursesSection } from "@/components/dashboard/CoursesSection";
import { RemindersList } from "@/components/dashboard/ExamReminder";
import { OrbNudge } from "@/components/dashboard/OrbNudge";
import { OverviewProvider } from "@/components/dashboard/OverviewContext";
import { LiveCreditsWidget, NextSessionWidget, PlanWidget, StreakWidget } from "@/components/dashboard/OverviewWidgets";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { TopicMastery } from "@/components/dashboard/TopicMastery";
import type { RoleDashboard } from "@/lib/auth/dashboard";
import { formatBeirut } from "@/lib/format/dates";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import type { TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";
import "@/styles/dashboard.css";

function greeting(now: Date, t: Messages["dashboard"]) {
  const hour = Number(formatBeirut(now.toISOString(), { hour: "numeric", hour12: false }, "en"));
  return hour >= 5 && hour < 12 ? t.morning : t.evening;
}

/**
 * Student home (redesign-v2 A). Server data (courses, reminders) renders immediately; plan / credits /
 * next session / streak come from /api/me/overview with skeletons and per-widget errors.
 */
export function StudentDashboard({ data, m, locale, teacherStatus }: { data: RoleDashboard; m: Messages; locale: Locale; teacherStatus: TeacherLiveStatus }) {
  const { user, courses, reminders } = data;
  const now = new Date();
  const firstName = user.name.split(" ")[0] || user.name;
  const [nearest, ...laterReminders] = reminders;
  return (
    <main className="shell mm-dash">
      <header className="mm-dash-hello">
        <span className="v2-avatar" aria-hidden="true">
          {firstName.charAt(0) || "?"}
        </span>
        <div>
          <h1>{fmt(m.dashboard.hello, { greeting: greeting(now, m.dashboard), name: firstName })}</h1>
          <p className="eyebrow">{formatBeirut(now.toISOString(), { weekday: "long", day: "numeric", month: "long" }, locale)}</p>
        </div>
      </header>
      <OrbNudge reminder={nearest} courses={courses} m={m} locale={locale} />
      <OverviewProvider>
        <div className="mm-dash-grid">
          <div className="mm-dash-col">
            <div className="v2-stats">
              <StreakWidget />
              <LiveCreditsWidget />
            </div>
            <ContinueLesson courses={courses} m={m} locale={locale} />
            <TopicMastery courses={courses} m={m} locale={locale} />
            <QuickActions />
          </div>
          <aside className="mm-dash-col">
            <NextSessionWidget teacherStatus={teacherStatus} />
            <PlanWidget />
            {laterReminders.length ? <RemindersList reminders={laterReminders} m={m} locale={locale} /> : null}
          </aside>
        </div>
      </OverviewProvider>
      <CoursesSection courses={courses} m={m} locale={locale} />
    </main>
  );
}
