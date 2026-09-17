"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import type { ExamPaper, GradeTrack } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function PracticeHubPage() {
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [exams, setExams] = useState<ExamPaper[]>([]);

  const lessons = useMemo(() => academyLessons.filter((item) => item.track === track), [track]);

  useEffect(() => {
    if (!lessons.some((item) => item.id === lessonId)) setLessonId(lessons[0]?.id ?? "");
  }, [lessons, lessonId]);

  useEffect(() => {
    void fetch("/api/exams")
      .then((response) => response.json())
      .then((data: { exams?: ExamPaper[] }) => setExams(data.exams ?? []));
  }, []);

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">بنك الأسئلة</p>
      <h1>الاختبارات والتدرّب</h1>
      <p className="muted">اختر الصف والدرس، ثم تدريب حر بدون وقت أو امتحان رسمي بمؤقت.</p>
      <div className="card">
        <label>
          الصف / المادة
          <select
            value={track}
            onChange={(event) => setTrack(event.target.value as GradeTrack)}
          >
            {gradeGroups.map((group) => (
              <option key={group.track} value={group.track}>
                {group.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          الوحدة / الدرس
          <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                Chapter {lesson.chapter} · {lesson.title}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <Link className="btn" href={`/practice/take?lessonId=${lessonId}&mode=free`}>
            تدريب حر
          </Link>
          <Link className="btn dark" href={`/practice/take?lessonId=${lessonId}&mode=exam`}>
            امتحان رسمي (15 دقيقة)
          </Link>
        </div>
      </div>
      {exams.length ? (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>اختبارات شاملة أعدّها الأستاذ</h2>
          {exams.map((exam) => (
            <p key={exam.id}>
              <Link href={`/practice/take?lessonId=${exam.lessonId || lessonId}&mode=exam&examId=${exam.id}`}>
                {exam.title} · {exam.durationMinutes} min · pass {exam.passScore}%
              </Link>
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}
