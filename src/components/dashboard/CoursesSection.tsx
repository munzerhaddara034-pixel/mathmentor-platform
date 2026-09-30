import Link from "next/link";
import type { DashboardCourse } from "@/lib/auth/dashboard";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { pickTitle } from "@/lib/i18n/pick";
import { WidgetEmpty } from "./WidgetStates";

function CourseCard({ course, m, locale }: { course: DashboardCourse; m: Messages; locale: Locale }) {
  const t = m.dashboard;
  const main = pickTitle(locale, course);
  const secondary = locale === "ar" ? course.title : course.arabicTitle;
  return (
    <article className="mm-card mm-course">
      <div className="mm-course-head">
        <div>
          <h3>{main}</h3>
          {secondary && secondary !== main ? (
            <span className="mm-course-sub" lang={locale === "ar" ? "en" : "ar"} dir="auto">
              {secondary}
            </span>
          ) : null}
        </div>
        <span className="mm-course-pct ltr">{course.percent}%</span>
      </div>
      <span className="v2-progress" role="img" aria-label={fmt(t.progressAria, { pct: `${course.percent}%` })}>
        <span style={{ width: `${course.percent}%` }} />
      </span>
      <ul className="mm-course-lessons">
        {course.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={lesson.href}>{pickTitle(locale, lesson)}</Link>
            <bdi dir="ltr">{lesson.percent}%</bdi>
          </li>
        ))}
      </ul>
      <div className="mm-course-actions">
        <Link className="v2-btn v2-btn-primary v2-btn-sm" href={course.href}>
          {t.enter}
        </Link>
        <Link className="v2-btn v2-btn-glass v2-btn-sm" href={course.practiceHref}>
          {t.practise}
        </Link>
      </div>
    </article>
  );
}

export function CoursesSection({ courses, m, locale }: { courses: DashboardCourse[]; m: Messages; locale: Locale }) {
  const t = m.dashboard;
  return (
    <section aria-labelledby="mm-courses">
      <h2 id="mm-courses" className="mm-dash-h2">
        {t.tracksTitle}
      </h2>
      {courses.length ? (
        <div className="mm-courses">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} m={m} locale={locale} />
          ))}
        </div>
      ) : (
        <div className="mm-card mm-widget">
          <WidgetEmpty
            title={t.tracksEmpty}
            body={t.tracksEmptyBody}
            action={
              <div className="mm-empty-actions">
                <Link href="/lessons" className="v2-btn v2-btn-primary v2-btn-sm">
                  {t.browse}
                </Link>
                <Link href="/redeem" className="v2-btn v2-btn-glass v2-btn-sm">
                  {t.haveCode}
                </Link>
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}
