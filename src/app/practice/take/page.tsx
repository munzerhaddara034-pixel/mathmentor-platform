"use client";

import { QuizEngine } from "@/components/QuizEngine";
import { getTopicBank } from "@/lib/topicBanks";
import type { ExamPaper, QuizQuestion } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function TakeQuizInner() {
  const search = useSearchParams();
  const bankId = search.get("bank") ?? "";
  const lessonIdParam = search.get("lessonId") ?? "grade-12-ch1";
  const requestedMode = search.get("mode") ?? "free";
  const mode = requestedMode === "contest" || requestedMode === "exam" ? requestedMode : "free";
  const examId = search.get("examId");
  const bank = bankId ? getTopicBank(bankId) : undefined;
  const lessonId = bank ? `bank:${bank.id}` : lessonIdParam;
  const [name, setName] = useState("طالب");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [exam, setExam] = useState<ExamPaper | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({ pack: "1" });
    if (bankId) {
      query.set("bank", bankId);
      if (mode === "contest") query.set("contest", "1");
    } else {
      query.set("lessonId", lessonIdParam);
      if (examId) query.set("examId", examId);
      else if (mode === "exam") query.set("limit", "12");
    }
    void fetch(`/api/quiz?${query.toString()}`)
      .then((response) => response.json())
      .then((data: { questions?: QuizQuestion[]; exam?: ExamPaper }) => {
        setQuestions(data.questions ?? []);
        setExam(data.exam ?? null);
      });
  }, [lessonIdParam, examId, bankId, mode]);

  const timed = mode === "exam" || mode === "contest";
  const duration = exam?.durationMinutes || (mode === "contest" ? (bank?.contestMinutes ?? 25) : 15);
  const passScore = exam?.passScore ?? bank?.passScore ?? 70;
  const heading =
    exam?.arabicTitle ??
    (mode === "contest" && bank ? `مسابقة ${bank.arabicTitle}` : mode === "exam" ? "امتحان رسمي" : "تدريب حر");

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">
        {mode === "contest" ? "مسابقة موضوع — سهل ثم متوسط ثم صعب" : timed ? "امتحان رسمي" : "تدريب حر"}
      </p>
      <h1>{heading}</h1>
      {bank ? (
        <p className="muted">
          {bank.certificate} · {bank.slices.map((slice) => slice.arabicTitle).join("، ")} · {questions?.length ?? "…"} سؤالاً
        </p>
      ) : null}
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
