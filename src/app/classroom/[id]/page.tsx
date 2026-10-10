"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { academyLessons, classroomScenes, getAcademyLesson, type AcademyLesson } from "@/lib/academyLessons";
import { grade12LsLimitsNotes, GRADE_12_LS_LIMITS_LESSON_ID } from "@/lib/grade12LsLimits";
import { isLessonUnlocked, PASS_SCORE } from "@/lib/gating";
import { DEFAULT_LESSON_LANG, type LessonLang } from "@/lib/lessonNotes";
import { copyForLang, getVideoLessonPack, notesForPack, scenesForPack } from "@/lib/videoLessons";
import { watermarkText } from "@/lib/videoSecurity";
import type { ProgressEntry, StoreData } from "@/lib/types";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { saveLocale } from "@/components/i18n/LocaleSwitcher";
import { fmt } from "@/lib/i18n/format";
import { classroomMessages } from "@/lib/i18n/ns/classroom";
import { pickTitle } from "@/lib/i18n/pick";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ClassroomLessonPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useI18n();
  const t = classroomMessages[locale].lesson;
  const [custom, setCustom] = useState<AcademyLesson[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [studentName, setStudentName] = useState<string>(t.defaultName);
  const [phone, setPhone] = useState("76532421");
  const [saved, setSaved] = useState(false);
  const [lang, setLang] = useState<LessonLang>(DEFAULT_LESSON_LANG);

  useEffect(() => {
    void fetch("/api/content")
      .then((response) => response.json())
      .then((store: StoreData) => {
        setCustom((store.customLessons ?? []) as AcademyLesson[]);
        setProgress(store.progress ?? []);
      });
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload: { user?: { name?: string; phone?: string } }) => {
        if (payload.user?.name) setStudentName(payload.user.name);
        if (payload.user?.phone) setPhone(payload.user.phone);
      })
      .catch(() => undefined);
  }, []);

  const lesson = useMemo(() => getAcademyLesson(params.id, custom), [params.id, custom]);
  const siblings = academyLessons.filter((item) => item.track === lesson?.track);
  const next = siblings.find((item) => item.chapter === (lesson?.chapter ?? 0) + 1);
  const unlocked = lesson ? isLessonUnlocked(lesson.id, progress) : true;
  const thisPassed = progress.some((item) => item.lessonId === lesson?.id && item.passedQuiz);
  const nextOpen = thisPassed || (next ? isLessonUnlocked(next.id, progress) : false);

  if (!lesson) {
    return (
      <main className="shell mm-mobile-stack">
        <p>{t.notFound}</p>
        <Link href="/classroom">{t.back}</Link>
      </main>
    );
  }

  if (!unlocked) {
    return (
      <main className="shell mm-mobile-stack">
        <h1>{t.lockedTitle}</h1>
        <p className="muted">{fmt(t.lockedLead, { n: PASS_SCORE })}</p>
        <Link className="btn dark" href="/classroom">
          {t.backIndex}
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

  const watermark = watermarkText(studentName, phone);
  const pack = getVideoLessonPack(lesson.id);
  const hasPilotNotes = lesson.id === GRADE_12_LS_LIMITS_LESSON_ID;
  const copy = pack ? copyForLang(pack, lang) : null;
  const pageDir = pack ? "ltr" : "rtl";
  const changeLanguage = (next: LessonLang) => {
    setLang(next);
    void saveLocale(next);
  };

  return (
    <main className="shell protected-lesson mm-mobile-stack" dir={pageDir} onContextMenu={(event) => event.preventDefault()}>
      <p className="eyebrow">
        {pack ? copy?.trackLabel : lesson.gradeLabel} · {pack ? copy?.title : pickTitle(locale, lesson)}
      </p>
      <h1>
        {pack ? copy?.title : fmt(t.chapterTitle, { n: lesson.chapter, title: pickTitle(locale, lesson) })}
      </h1>
      <p className="muted">{lesson.idea}</p>
      <div className="grid two">
        <p>
          Watermark identity (from profile): <strong>{studentName}</strong> · {phone}
        </p>
      </div>
      <LessonVideoPlayer
        videoUrl={lesson.videoUrl}
        videoUrlFr={lesson.videoUrlFr}
        heading={`${lesson.gradeLabel} · Ch. ${lesson.chapter}`}
        scenes={pack ? scenesForPack(pack, lang, lesson) : classroomScenes(lesson, lang)}
        scenesFr={pack?.fallbackFr}
        watermark={watermark}
        lang={lang}
        onLangChange={changeLanguage}
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
            {t.functionsContest}
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
  );
}
