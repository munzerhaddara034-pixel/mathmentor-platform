import Link from "next/link";
import { Ltr } from "@/components/ui/Ltr";
import type { DashboardCourse } from "@/lib/auth/dashboard";
import { WidgetEmpty } from "./WidgetStates";

function CourseCard({ course }: { course: DashboardCourse }) {
  return (
    <article className="mm-card mm-course">
      <div className="mm-course-head">
        <div>
          <h3>{course.arabicTitle}</h3>
          <Ltr className="mm-course-sub">{course.title}</Ltr>
        </div>
        <span className="mm-course-pct">
          <Ltr>{course.percent}%</Ltr>
        </span>
      </div>
      <span className="mm-progress" aria-label={`أنجزت ${course.percent}%`}>
        <span style={{ width: `${course.percent}%` }} />
      </span>
      <ul className="mm-course-lessons">
        {course.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link href={lesson.href}>{lesson.arabicTitle || lesson.title}</Link>
            <Ltr>{lesson.percent}%</Ltr>
          </li>
        ))}
      </ul>
      <div className="mm-course-actions">
        <Link className="btn dark" href={course.href}>
          ادخل الصف
        </Link>
        <Link className="ghost-btn ink" href={course.practiceHref}>
          تدرّب
        </Link>
      </div>
    </article>
  );
}

export function CoursesSection({ courses }: { courses: DashboardCourse[] }) {
  return (
    <section aria-labelledby="mm-courses">
      <h2 id="mm-courses" className="mm-dash-h2">
        مساراتي
      </h2>
      {courses.length ? (
        <div className="mm-courses">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="mm-card mm-widget">
          <WidgetEmpty
            title="لم تُسجَّل في أي مسار بعد"
            body="ابدأ بالدروس المجانية، أو فعّل اشتراكك برمز التفعيل."
            action={
              <div className="mm-empty-actions">
                <Link href="/lessons" className="btn dark">
                  تصفّح الدروس
                </Link>
                <Link href="/redeem" className="ghost-btn ink">
                  لديّ رمز تفعيل
                </Link>
              </div>
            }
          />
        </div>
      )}
    </section>
  );
}
