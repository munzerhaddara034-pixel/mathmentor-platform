"use client";

import { QuizEngine } from "@/components/QuizEngine";
import { PremiumExamGate } from "@/components/PremiumExamGate";
import { assembleBankExam, assembleExam } from "@/lib/examCatalog";
import { getTopicBank } from "@/lib/topicBanks";
import type { ExamPaper, QuizQuestion } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function TakeQuizInner() {
  const search = useSearchParams();
  const packId = search.get("pack") ?? "";
  const bankId = search.get("bank") ?? "";
  const lessonIdParam = search.get("lessonId") ?? "grade-12-ch1";
  const requestedMode = search.get("mode") ?? "free";
  const mode = requestedMode === "contest" || requestedMode === "exam" ? requestedMode : "free";
  const examId = search.get("examId");
  const bank = bankId ? getTopicBank(bankId) : undefined;
  const assembled = useMemo(() => {
    if (packId) return assembleExam(packId);
    if (bankId) return assembleBankExam(bankId, mode === "free" ? "free" : "contest");
    return null;
  }, [packId, bankId, mode]);
  const lessonId = assembled ? `exam:${assembled.pack.id}` : bank ? `bank:${bank.id}` : lessonIdParam;
  const [name, setName] = useState("طالب");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(assembled?.questions ?? null);
  const [exam, setExam] = useState<ExamPaper | null>(null);

  useEffect(() => {
    if (assembled) {
      setQuestions(assembled.questions);
      return;
    }
    const query = new URLSearchParams({ pack: "1" });
    query.set("lessonId", lessonIdParam);
    if (examId) query.set("examId", examId);
    else if (mode === "exam") query.set("limit", "12");
    void fetch(`/api/quiz?${query.toString()}`)
      .then((response) => response.json())
      .then((data: { questions?: QuizQuestion[]; exam?: ExamPaper }) => {
        setQuestions(data.questions ?? []);
        setExam(data.exam ?? null);
      });
  }, [lessonIdParam, examId, assembled, mode]);

  const timed = Boolean(assembled ? assembled.pack.durationMinutes : mode === "exam" || mode === "contest");
  const duration =
    assembled?.pack.durationMinutes ||
    exam?.durationMinutes ||
    (mode === "contest" ? (bank?.contestMinutes ?? 25) : 15);
  const passScore = assembled?.pack.passScore ?? exam?.passScore ?? bank?.passScore ?? 70;
  const heading =
    assembled?.pack.arabicTitle ??
    exam?.arabicTitle ??
    (mode === "contest" && bank ? `مسابقة ${bank.arabicTitle}` : mode === "exam" ? "امتحان رسمي" : "تدريب حر");

  return (
    <PremiumExamGate
      certificate={assembled?.pack.certificate ?? bank?.certificate}
      track={bank && (mode === "contest" || mode === "exam") ? String(bank.track) : undefined}
      lessonId={!assembled && !bank ? lessonIdParam : undefined}
    >
    <main className="shell" dir="rtl">
      <p className="eyebrow">
        {assembled
          ? assembled.pack.styleTag
          : mode === "contest"
            ? "مسابقة موضوع — سهل ثم متوسط ثم صعب"
            : timed
              ? "امتحان رسمي"
              : "تدريب حر"}
      </p>
      <h1>{heading}</h1>
      {assembled ? <p className="muted">{assembled.pack.disclaimer}</p> : null}
      {bank && !assembled ? (
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
          key={assembled?.pack.id ?? lessonId}
          questions={questions}
          timed={timed}
          durationMinutes={duration}
          passScore={passScore}
          studentName={name}
          lessonId={lessonId}
          parts={assembled?.pack.parts}
          pack={assembled?.pack}
          printHref={assembled ? `/exams/print?pack=${encodeURIComponent(assembled.pack.id)}&mode=paper` : undefined}
        />
      ) : (
        <p className="muted">جارٍ تجهيز الأسئلة…</p>
      )}
    </main>
    </PremiumExamGate>
  );
}

export default function TakeQuizPage() {
  return (
    <Suspense fallback={<main className="shell">جارٍ التحميل…</main>}>
      <TakeQuizInner />
    </Suspense>
  );
}
