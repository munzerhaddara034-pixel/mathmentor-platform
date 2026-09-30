"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { classroomScenes, getAcademyLesson } from "@/lib/academyLessons";
import { GRADE_12_LS_LIMITS_LESSON_ID, GRADE_12_LS_LIMITS_VIDEO_URL, grade12LsLimitsNotes } from "@/lib/grade12LsLimits";
import { grade12LsCh1Scenes } from "@/lib/grade12LsCh1";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";

export default function Grade12LsChapter1Page() {
  const lesson = getAcademyLesson(GRADE_12_LS_LIMITS_LESSON_ID);
  const { m } = useI18n();
  const t = useNs(lessonsMessages);
  return (
    <main className="shell">
      <p className="eyebrow">{t.limitsEyebrow}</p>
      <h1>{t.limitsTitle}</h1>
      <p className="muted">{t.limitsLead}</p>
      <LessonVideoPlayer
        videoUrl={lesson?.videoUrl ?? GRADE_12_LS_LIMITS_VIDEO_URL}
        heading={t.limitsHeading}
        scenes={lesson ? classroomScenes(lesson) : grade12LsCh1Scenes}
        watermark={`${m.result.watermarkGuest} · 76532421`}
      />
      <LessonNotes blocks={grade12LsLimitsNotes} />
      <article className="card" style={{ marginBlockStart: 24 }}>
        <h3>{t.afterTitle}</h3>
        <p className="muted">{t.limitsAfterLead}</p>
        <div className="row">
          <Link href={`/practice/take?lessonId=${GRADE_12_LS_LIMITS_LESSON_ID}&mode=free`} className="btn dark">
            {t.limitsPractice}
          </Link>
          <Link href="/practice/take?bank=g12-ls-functions&mode=contest" className="btn">
            {t.limitsContest}
          </Link>
          <Link href={`/classroom/${GRADE_12_LS_LIMITS_LESSON_ID}`} className="btn">
            {t.classPage}
          </Link>
        </div>
      </article>
    </main>
  );
}
