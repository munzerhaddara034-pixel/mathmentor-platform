"use client";

import { LessonNotes } from "@/components/LessonNotes";
import { LessonVideoPlayer } from "@/components/LessonVideoPlayer";
import { academyLessons, classroomScenes, getAcademyLesson, type AcademyLesson } from "@/lib/academyLessons";
import { grade12LsLimitsNotes, GRADE_12_LS_LIMITS_LESSON_ID } from "@/lib/grade12LsLimits";
import { isLessonUnlocked, PASS_SCORE } from "@/lib/gating";
import { watermarkText } from "@/lib/videoSecurity";
import type { ProgressEntry, StoreData } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ClassroomLessonPage() {
  const params = useParams<{ id: string }>();
  const [custom, setCustom] = useState<AcademyLesson[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [studentName, setStudentName] = useState("طالب المنصة");
  const [phone, setPhone] = useState("76532421");
  const [saved, setSaved] = useState(false);

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

  const watermark = watermarkText(studentName, phone);
  const hasPilotNotes = lesson.id === GRADE_12_LS_LIMITS_LESSON_ID;

  return (
    <main className="shell protected-lesson" dir="rtl" onContextMenu={(event) => event.preventDefault()}>
      <p className="eyebrow">
        {lesson.gradeLabel} · {lesson.arabicTitle}
      </p>
      <h1>
        الفصل {lesson.chapter} · {lesson.arabicTitle}
      </h1>
      <p className="muted">{lesson.idea}</p>
      <div className="grid two">
        <label>
          اسمك على الفيديو
          <input value={studentName} onChange={(event) => setStudentName(event.target.value)} />
        </label>
        <label>
          رقم هاتفك للعلامة المائية
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
      </div>
      <LessonVideoPlayer
        videoUrl={lesson.videoUrl}
        heading={`${lesson.gradeLabel} · Ch. ${lesson.chapter}`}
        scenes={classroomScenes(lesson)}
        watermark={watermark}
      />
      {!lesson.videoUrl ? (
        <p className="muted" style={{ marginTop: 8 }}>
          لا يوجد ملف فيديو مسجّل لهذا الدرس بعد. يُعرض اللوح التفاعلي إلى أن يضع الأستاذ رابط يوتيوب أو ملفاً في{" "}
          <code>public/videos/</code>.
        </p>
      ) : null}
      {hasPilotNotes ? <LessonNotes blocks={grade12LsLimitsNotes} /> : null}
      <div className="row" style={{ marginTop: 20 }}>
        <Link className="btn dark" href={`/practice/take?lessonId=${lesson.id}&mode=exam`}>
          امتحان الدرس (70% لفتح التالي)
        </Link>
        <Link className="btn" href={`/practice/take?lessonId=${lesson.id}&mode=free`}>
          تدريب حر
        </Link>
        <button className="btn ok" type="button" onClick={() => void complete()}>
          {saved ? "Saved to your path" : "I finished this lesson"}
        </button>
        {next ? (
          nextOpen || thisPassed ? (
            <Link className="btn dark" href={`/classroom/${next.id}`}>
              Next chapter
            </Link>
          ) : (
            <span className="muted">الدرس التالي مقفل حتى نجاح الاختبار</span>
          )
        ) : null}
        <Link className="btn" href={`/resources/print/${lesson.id}`}>
          ملخص / ورقة عمل
        </Link>
        <Link className="btn" href="/student">
          Ask in chat
        </Link>
      </div>
    </main>
  );
}
