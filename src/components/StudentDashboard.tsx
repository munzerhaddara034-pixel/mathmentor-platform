import { ContinueLesson } from "@/components/dashboard/ContinueLesson";
import { CoursesSection } from "@/components/dashboard/CoursesSection";
import { ExamReminder, RemindersList } from "@/components/dashboard/ExamReminder";
import { OverviewProvider } from "@/components/dashboard/OverviewContext";
import { NextSessionWidget, PlanWidget, StreakWidget } from "@/components/dashboard/OverviewWidgets";
import { QuickActions } from "@/components/dashboard/QuickActions";
import type { RoleDashboard } from "@/lib/auth/dashboard";
import { formatBeirut } from "@/lib/format/dates";
import "@/styles/dashboard.css";

function greeting(now: Date) {
  const hour = Number(formatBeirut(now.toISOString(), { hour: "numeric", hour12: false }));
  return hour >= 5 && hour < 12 ? "صباح الخير" : "مساء الخير";
}

/**
 * Student home: server data (courses, reminders from the profile DB) renders immediately;
 * plan / next session / streak come from /api/me/overview with skeletons and per-widget errors.
 */
export function StudentDashboard({ data }: { data: RoleDashboard }) {
  const { user, courses, reminders } = data;
  const now = new Date();
  const firstName = user.name.split(" ")[0] || user.name;
  const [nearest, ...laterReminders] = reminders;
  return (
    <main className="shell mm-dash">
      <header className="mm-dash-hello">
        <p className="eyebrow">
          {greeting(now)} · {formatBeirut(now.toISOString(), { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1>أهلاً {firstName}</h1>
      </header>
      <OverviewProvider>
        <div className="mm-dash-grid">
          <div className="mm-dash-col">
            <PlanWidget />
            {nearest ? <ExamReminder reminder={nearest} /> : null}
            <ContinueLesson courses={courses} />
            <QuickActions />
          </div>
          <aside className="mm-dash-col">
            <NextSessionWidget />
            <StreakWidget />
            {laterReminders.length ? <RemindersList reminders={laterReminders} /> : null}
          </aside>
        </div>
      </OverviewProvider>
      <CoursesSection courses={courses} />
    </main>
  );
}
