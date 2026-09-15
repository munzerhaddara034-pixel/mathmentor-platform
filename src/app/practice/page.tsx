"use client";

import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { groupTopicBankCards, listTopicBankCards } from "@/lib/topicBanks";
import type { ExamPaper, GradeTrack } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export default function PracticeHubPage() {
  const [track, setTrack] = useState<GradeTrack>("grade-12");
  const [lessonId, setLessonId] = useState("grade-12-ch1");
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const grouped = groupTopicBankCards();

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
        <p className="muted">مستويان: علوم الحياة (صف 12) والشهادة المتوسطة (صف 9). البنود أكاديمية أصلية بأسلوب النماذج، وليست نسخاً من دورات رسمية.</p>

        <h3 style={{ marginTop: 16 }}>صف 12 · علوم الحياة</h3>
        <p className="muted">النموذج الرسمي أربع مسائل: أسئلة مختلطة، هندسة فضاء، احتمالات، ثم دراسة الدوال. المنفَّذ الآن هو المسألة الرابعة.</p>
        {grouped.ls[0]?.contestTopics?.map((topic) => (
          <p key={topic.id} className="muted" style={{ margin: "4px 0" }}>
            {topic.arabicTitle ?? topic.title}
            {topic.implemented ? " — هذا البنك" : " — لاحقاً"}
          </p>
        ))}
        {grouped.ls.map((card) => (
          <BankCard key={card.id} card={card} />
        ))}

        <h3 style={{ marginTop: 24 }}>صف 9 · الشهادة المتوسطة</h3>
        <p className="muted">مسابقة البروفيه عادةً ست أو سبع مسائل. البنوك الخمسة جاهزة للمسابقة: أعداد، جبر، مسائل لفظية، هندسة، هندسة تحليلية.</p>
        {grouped.brevet[0]?.contestTopics?.map((topic) => (
          <p key={topic.id} className="muted" style={{ margin: "4px 0" }}>
            {topic.arabicTitle ?? topic.title}
            {topic.implemented ? " — هذا البنك" : " — لاحقاً"}
          </p>
        ))}
        {grouped.brevet.map((card) => (
          <BankCard key={card.id} card={card} />
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

function BankCard({
  card,
}: {
  card: ReturnType<typeof listTopicBankCards>[number];
}) {
  const blurb =
    card.id === "g12-ls-functions"
      ? "أسلوب المسألة الرابعة في نماذج علوم الحياة. البنود أكاديمية أصلية وليست نماذج منسوخة."
      : card.certificate === "Brevet"
        ? "أسلوب الشهادة المتوسطة. البنود أكاديمية أصلية وليست نماذج منسوخة."
        : null;
  return (
    <article className="card" style={{ marginTop: 12 }}>
      <span className="badge">{card.certificate}</span>
      <h3>
        {card.certificate} — {card.arabicTitle}
      </h3>
      <p className="muted">
        {card.questionCount} سؤالاً · {card.slices.map((slice) => slice.arabicTitle).join(" · ")} · المسابقة {card.contestMinutes} دقيقة
      </p>
      {blurb ? <p className="muted">{blurb}</p> : null}
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
  );
}
