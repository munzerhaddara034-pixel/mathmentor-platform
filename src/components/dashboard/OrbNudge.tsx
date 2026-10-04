import Link from "next/link";
import { OpenAssistantButton } from "@/components/dashboard/OpenAssistantButton";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import type { DashboardCourse, DashboardReminder } from "@/lib/auth/dashboard";
import type { Locale } from "@/lib/i18n/config";
import { fmt, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import { pickTitle } from "@/lib/i18n/pick";
import { nextLesson } from "./ContinueLesson";

/** Youssef's (AI tutor) nudge, built only from real data: nearest exam → unfinished lesson → "snap a problem". */
function buildNudge(reminder: DashboardReminder | undefined, courses: DashboardCourse[], m: Messages, locale: Locale) {
  const t = m.dashboard;
  if (reminder && reminder.href) {
    const title = pickTitle(locale, reminder);
    const text =
      reminder.daysLeft <= 0
        ? fmt(t.nudgeExamToday, { title })
        : fmt(t.nudgeExam, { title, days: fmt(plural(reminder.daysLeft, t.days), { n: reminder.daysLeft }) });
    return { text, href: reminder.href, cta: t.nudgeCtaPractice };
  }
  const next = nextLesson(courses);
  if (next && next.lesson.percent > 0) {
    return { text: fmt(t.nudgeLesson, { pct: `${next.lesson.percent}%`, title: pickTitle(locale, next.lesson) }), href: next.lesson.href, cta: t.nudgeCtaLesson };
  }
  return { text: t.nudgeStart, href: "/math-solver", cta: t.nudgeCtaSolve };
}

export function OrbNudge({ reminder, courses, m, locale }: { reminder?: DashboardReminder; courses: DashboardCourse[]; m: Messages; locale: Locale }) {
  const nudge = buildNudge(reminder, courses, m, locale);
  return (
    <section className="v2-nudge glass" aria-label={m.persona.label}>
      <div className="v2-nudge-copy">
        <p className="v2-nudge-who v2-persona-line">
          {m.persona.name} <AiTutorBadge label={m.persona.ai} />
        </p>
        <p className="v2-nudge-text">{nudge.text}</p>
      </div>
      <TutorOrb size={64} className="v2-nudge-orb" />
      <div className="v2-nudge-actions">
        <Link href={nudge.href} className="v2-btn v2-btn-gold">
          {nudge.cta}
        </Link>
        <OpenAssistantButton label={m.dashboard.nudgeLater} />
      </div>
    </section>
  );
}
