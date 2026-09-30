import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { DashboardCourse } from "@/lib/auth/dashboard";
import type { Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { pickTitle } from "@/lib/i18n/pick";
import { WidgetEmpty } from "./WidgetStates";

/** Picks the first unfinished lesson of the first enrolled course (real progress rows). */
export function nextLesson(courses: DashboardCourse[]) {
  for (const course of courses) {
    const index = course.lessons.findIndex((lesson) => lesson.percent < 100);
    if (index >= 0) return { course, lesson: course.lessons[index], index };
  }
  return null;
}

/** Decorative whiteboard thumbnail (SVG, no image request). */
function BoardThumb() {
  return (
    <span className="v2-board-thumb" aria-hidden="true">
      <svg viewBox="0 0 96 64" width="96" height="64">
        <path d="M10 18h30M10 28h22M52 16l8 8 8-8M10 44c14-14 24 6 38-6s22-12 38-4" />
      </svg>
      <span className="v2-board-play">
        <Icon name="play" size={16} filled />
      </span>
    </span>
  );
}

export function ContinueLesson({ courses, m, locale }: { courses: DashboardCourse[]; m: Messages; locale: Locale }) {
  const t = m.dashboard;
  const next = nextLesson(courses);
  return (
    <section className="mm-card mm-widget" aria-labelledby="mm-continue">
      <div className="mm-widget-head">
        <h2 id="mm-continue">{t.continueTitle}</h2>
        <Link href="/lessons" className="mm-link">
          {t.continueAll}
        </Link>
      </div>
      {next ? (
        <Link href={next.lesson.href} className="mm-continue">
          <BoardThumb />
          <span className="mm-continue-body">
            <span className="v2-chip">{t.boardLesson}</span>
            <strong>{pickTitle(locale, next.lesson)}</strong>
            <span>{fmt(t.continueMeta, { course: pickTitle(locale, next.course), i: next.index + 1, n: next.course.lessons.length })}</span>
            <span className="v2-progress" role="img" aria-label={fmt(t.progressAria, { pct: `${next.lesson.percent}%` })}>
              <span style={{ width: `${next.lesson.percent}%` }} />
            </span>
            <small>{fmt(t.continueDone, { pct: `${next.lesson.percent}%` })}</small>
          </span>
        </Link>
      ) : (
        <WidgetEmpty
          title={courses.length ? t.continueFinished : t.continueEmpty}
          body={courses.length ? t.continueFinishedBody : t.continueEmptyBody}
          action={
            <Link href="/lessons" className="v2-btn v2-btn-primary v2-btn-sm">
              {t.browse}
            </Link>
          }
        />
      )}
    </section>
  );
}
