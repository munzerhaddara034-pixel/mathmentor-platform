import type { DashboardCourse } from "@/lib/auth/dashboard";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";
import { pickTitle } from "@/lib/i18n/pick";

/** Mastery = real per-lesson progress from the profile DB (first 6 lessons across the student's tracks). */
export function TopicMastery({ courses, m, locale }: { courses: DashboardCourse[]; m: Messages; locale: Locale }) {
  const t = m.dashboard;
  const rows = courses.flatMap((course) => course.lessons).slice(0, 6);
  return (
    <section className="mm-card mm-widget" aria-labelledby="v2-mastery">
      <div className="mm-widget-head">
        <h2 id="v2-mastery">{t.masteryTitle}</h2>
      </div>
      {rows.length ? (
        <ul className="v2-mastery">
          {rows.map((lesson) => (
            <li key={lesson.id}>
              <span className="v2-mastery-name">{pickTitle(locale, lesson)}</span>
              <span className="v2-progress" aria-hidden="true">
                <span style={{ width: `${lesson.percent}%` }} />
              </span>
              <b className="ltr">{lesson.percent}%</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="v2-muted v2-small">{t.masteryEmpty}</p>
      )}
    </section>
  );
}
