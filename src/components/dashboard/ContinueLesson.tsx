import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";
import type { DashboardCourse } from "@/lib/auth/dashboard";
import { WidgetEmpty } from "./WidgetStates";

/** Picks the first unfinished lesson of the first enrolled course (real progress rows). */
function nextLesson(courses: DashboardCourse[]) {
  for (const course of courses) {
    const index = course.lessons.findIndex((lesson) => lesson.percent < 100);
    if (index >= 0) return { course, lesson: course.lessons[index], index };
  }
  return null;
}

export function ContinueLesson({ courses }: { courses: DashboardCourse[] }) {
  const next = nextLesson(courses);
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-continue">
      <div className="mm-widget-head">
        <h2 id="mm-continue">تابع من حيث توقفت</h2>
        <Link href="/lessons" className="mm-link">
          كل الدروس
        </Link>
      </div>
      {next ? (
        <Link href={next.lesson.href} className="mm-continue">
          <span className="mm-continue-play" aria-hidden="true">
            <Icon name="play" size={22} />
          </span>
          <span className="mm-continue-body">
            <strong>{next.lesson.arabicTitle || next.lesson.title}</strong>
            <span>
              {next.course.arabicTitle} · الدرس <Ltr>{next.index + 1}</Ltr> من <Ltr>{next.course.lessons.length}</Ltr>
            </span>
            <span className="mm-progress" aria-label={`أنجزت ${next.lesson.percent}%`}>
              <span style={{ width: `${next.lesson.percent}%` }} />
            </span>
            <small>
              <Ltr>{next.lesson.percent}%</Ltr> مكتمل
            </small>
          </span>
        </Link>
      ) : (
        <WidgetEmpty
          title={courses.length ? "أنهيت كل دروس مساراتك 🎉" : "لم تبدأ أي درس بعد"}
          body={courses.length ? "راجع بالتمارين أو جرّب محاكاة امتحان." : "اختر درساً من المكتبة وابدأ الآن."}
          action={
            <Link href="/lessons" className="btn dark">
              تصفّح الدروس
            </Link>
          }
        />
      )}
    </section>
  );
}
