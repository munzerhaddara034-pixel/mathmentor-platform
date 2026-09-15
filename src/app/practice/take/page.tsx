"use client";

import { QuizEngine } from "@/components/QuizEngine";
import type { ExamPaper, QuizQuestion } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function TakeQuizInner() {
  const search = useSearchParams();
  const lessonId = search.get("lessonId") ?? "grade-12-ch1";
  const mode = search.get("mode") === "exam" ? "exam" : "free";
  const examId = search.get("examId");
  const [name, setName] = useState("طالب");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [exam, setExam] = useState<ExamPaper | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ lessonId, pack: "1" });
    if (examId) query.set("examId", examId);
    void fetch(`/api/quiz?${query.toString()}`)
      .then((response) => response.json())
      .then((data: { questions?: QuizQuestion[]; exam?: ExamPaper }) => {
        setQuestions(data.questions ?? []);
        setExam(data.exam ?? null);
      });
  }, [lessonId, examId]);

  const timed = mode === "exam";
  const duration = exam?.durationMinutes ?? 15;
  const passScore = exam?.passScore ?? 70;

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">{timed ? "امتحان رسمي" : "تدريب حر"}</p>
      <h1>{exam?.title ?? "Interactive quiz"}</h1>
      <label>
        اسمك للصدارة
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {questions ? (
        <QuizEngine
          questions={questions}
          timed={timed}
          durationMinutes={duration}
          passScore={passScore}
          studentName={name}
          lessonId={lessonId}
        />
      ) : (
        <p className="muted">جارٍ تجهيز الأسئلة…</p>
      )}
    </main>
  );
}

export default function TakeQuizPage() {
  return (
    <Suspense fallback={<main className="shell">جارٍ التحميل…</main>}>
      <TakeQuizInner />
    </Suspense>
  );
}
