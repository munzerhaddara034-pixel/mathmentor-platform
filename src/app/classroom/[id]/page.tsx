"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { SecurePlayerShell } from "@/components/SecurePlayerShell";
import { academyLessons, classroomScenes, getAcademyLesson, type AcademyLesson } from "@/lib/academyLessons";
import { grade12LsLimitsNotes, GRADE_12_LS_LIMITS_LESSON_ID } from "@/lib/grade12LsLimits";
import { isLessonUnlocked, PASS_SCORE } from "@/lib/gating";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import { copyForLang, getVideoLessonPack, notesForPack, scenesForPack } from "@/lib/videoLessons";
import type { ProgressEntry, StoreData } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ClassroomLessonPage() {
  const params = useParams<{ id: string }>();
  const [custom, setCustom] = useState<AcademyLesson[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<LessonLang>(DEFAULT_LESSON_LANG);

  useEffect(() => {
    void fetch("/api/content")
      .then((response) => response.json())
      .then((store: StoreData) => {
        setCustom((store.customLessons ?? []) as AcademyLesson[]);
        setProgress(store.progress ?? []);
      });
  }, []);

  const lesson = useMemo(() => getAcademyLesson(params.id, custom), [params.id, custom]);
  const siblings = academyLessons.filter((item) => item.track === lesson?.track);
  const next = siblings.find((item) => item.chapter === (lesson?.chapter ?? 0) + 1);
  const unlocked = lesson ? isLessonUnlocked(lesson.id, progress) : true;
  const thisPassed = progress.some((item) => item.lessonId === lesson?.id && item.passedQuiz);
  const nextOpen = thisPassed || (next ? isLessonUnlocked(next.id, progress) : false);

  if (!lesson) {
    return (
      <main className="shell">
        <p>Lesson not found.</p>
        <Link href="/classroom">Back to classroom</Link>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="shell" dir="rtl">
        <h1>الدرس مقفل</h1>
        <p className="muted">يجب اجتياز اختبار الدرس السابق بنسبة {PASS_SCORE}% على الأقل.</p>
        <Link className="btn dark" href="/classroom">
          العودة للفهرس
        </Link>
      </main>
    );
  }

  const complete = async () => {
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: lesson.id }),
    });
    setSaved(true);
  };

  const pack = getVideoLessonPack(lesson.id);
  const hasPilotNotes = lesson.id === GRADE_12_LS_LIMITS_LESSON_ID;
  const copy = pack ? copyForLang(pack, lang) : null;
  const pageDir = pack ? "ltr" : "rtl";

  return (
    <SecurePlayerShell lessonId={lesson.id}>
      {({ watermark }) => (
        <main className="shell protected-lesson" dir={pageDir} onContextMenu={(event) => event.preventDefault()}>
          <p className="eyebrow">
            {pack ? copy?.trackLabel : lesson.gradeLabel} · {pack ? copy?.title : lesson.arabicTitle}
          </p>
          <h1>{pack ? copy?.title : `الفصل ${lesson.chapter} · ${lesson.arabicTitle}`}</h1>
          <p className="muted">{lesson.idea}</p>
          <LessonVideoPlayer
            videoUrl={lesson.videoUrl}
            videoUrlFr={lesson.videoUrlFr}
            heading={`${lesson.gradeLabel} · Ch. ${lesson.chapter}`}
            scenes={pack ? scenesForPack(pack, lang, lesson) : classroomScenes(lesson, lang)}
            scenesFr={pack?.fallbackFr}
            watermark={watermark}
            lang={lang}
            onLangChange={setLang}
          />
          {!lesson.videoUrl ? (
            <p className="muted" style={{ marginTop: 8 }}>
              No recorded file for this lesson yet. The interactive board plays until a YouTube link or a file in{" "}
              <code>public/videos/</code> is set.
            </p>
          ) : null}
          {pack ? <LessonNotes blocks={notesForPack(pack, lang)} dir="ltr" /> : null}
          {hasPilotNotes ? <LessonNotes blocks={grade12LsLimitsNotes} dir="rtl" /> : null}
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn dark" href={`/practice/take?lessonId=${lesson.id}&mode=exam`}>
              {copy?.exam ?? "Lesson exam (70% to unlock next)"}
            </Link>
            <Link className="btn" href={pack?.practiceHref ?? `/practice/take?lessonId=${lesson.id}&mode=free`}>
              {copy?.practice ?? "Practice"}
            </Link>
            {pack ? (
              <Link className="btn" href={pack.contestHref}>
                {copy?.contestLabel}
              </Link>
            ) : null}
            {hasPilotNotes ? (
              <Link className="btn" href="/practice/take?bank=g12-ls-functions&mode=contest">
                مسابقة الدوال
              </Link>
            ) : null}
            <button className="btn ok" type="button" onClick={() => void complete()}>
              {saved ? copy?.saved ?? "Saved to your path" : copy?.finished ?? "I finished this lesson"}
            </button>
            {next ? (
              nextOpen || thisPassed ? (
                <Link className="btn dark" href={`/classroom/${next.id}`}>
                  Next chapter
                </Link>
              ) : (
                <span className="muted">Next lesson unlocks after a passing quiz</span>
              )
            ) : null}
            <Link className="btn" href={`/resources/print/${lesson.id}`}>
              Notes / worksheet
            </Link>
            {pack ? (
              <Link className="btn" href={pack.watchPath}>
                Watch route
              </Link>
            ) : null}
            <Link className="btn" href="/student">
              Ask in chat
            </Link>
          </div>
        </main>
      )}
    </SecurePlayerShell>
  );
}
