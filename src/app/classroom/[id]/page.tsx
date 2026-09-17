"use client";

import { ClassroomStudio } from "@/components/ClassroomStudio";
import { academyLessons, classroomScenes, getAcademyLesson, type AcademyLesson } from "@/lib/academyLessons";
import { isLessonUnlocked, PASS_SCORE } from "@/lib/gating";
import { videoSecurity, hostedEmbedSrc, watermarkText } from "@/lib/videoSecurity";
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

  return (
    <main className="shell protected-lesson" dir="rtl" onContextMenu={(event) => event.preventDefault()}>
      <p className="eyebrow">
        {lesson.gradeLabel} · مشغّل {videoSecurity.provider} · علامة مائية متحركة
      </p>
      <h1>
        Chapter {lesson.chapter} · {lesson.title}
      </h1>
      <p className="muted">
        {lesson.title}. No direct download. Bunny / Vimeo OTT / Wistia connect through environment variables when available.
      </p>
      <div className="grid two">
        <p>
          Watermark identity (from profile): <strong>{studentName}</strong> · {phone}
        </p>
      </div>
      {hostedEmbedSrc() ? (
        <div className="secure-embed">
          <iframe title="Protected video" src={hostedEmbedSrc()} allow="autoplay; fullscreen" allowFullScreen />
          <span className="dynamic-watermark">{watermarkText(studentName, phone)}</span>
        </div>
      ) : null}
      <ClassroomStudio
        heading={`${lesson.gradeLabel} · Ch. ${lesson.chapter}`}
        scenes={classroomScenes(lesson)}
        watermark={watermarkText(studentName, phone)}
      />
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
