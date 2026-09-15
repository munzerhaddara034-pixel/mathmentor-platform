"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { listTopicBankCards } from "@/lib/topicBanks";
import type { ExamPaper, GradeTrack } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function PracticeHubPage() {
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const topicCards = listTopicBankCards();

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
      <p className="muted">مسابقة الشهادة حسب الموضوع، أو تدريب درس واحد. الأسئلة بمستوى النماذج اللبنانية لا قوالب تعريف.</p>

      <section className="card" style={{ marginTop: 8 }}>
        <h2>مسابقات الشهادة حسب الموضوع</h2>
        <p className="muted">
          تُقسَّم نماذج علوم الحياة إلى نحو أربعة بنوك. التجريبي: <strong>الدوال</strong> (النهايات أولاً، ثم الاستمرار، ثم المشتقات)، مرتّب سهل → صعب.
        </p>
        {topicCards.map((card) => (
          <article key={card.id} className="card" style={{ marginTop: 12 }}>
            <span className="badge">{card.certificate}</span>
            <h3>
              {card.certificate} — {card.arabicTitle}
            </h3>
            <p className="muted">
              {card.questionCount} سؤالاً · {card.slices.map((slice) => slice.arabicTitle).join(" · ")} · المسابقة {card.contestMinutes} دقيقة
            </p>
            <div className="row">
              <Link className="btn dark" href={`/practice/take?bank=${card.id}&mode=contest`}>
                مسابقة {card.arabicTitle}
              </Link>
              <Link className="btn" href={`/practice/take?bank=${card.id}&mode=free`}>
                تدريب البنك كاملاً
              </Link>
              {card.id === "g12-ls-functions" ? (
                <Link className="btn" href="/classroom/grade-12-ch1">
                  درس النهايات (فيديو)
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>تدريب درس واحد</h2>
        <label>
          الصف / المادة
          <select value={track} onChange={(event) => setTrack(event.target.value as GradeTrack)}>
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
                Chapter {lesson.chapter} · {lesson.arabicTitle || lesson.title}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <Link className="btn" href={`/practice/take?lessonId=${lessonId}&mode=free`}>
            تدريب حر
          </Link>
          <Link className="btn dark" href={`/practice/take?lessonId=${lessonId}&mode=exam`}>
            امتحان الدرس (15 دقيقة)
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
