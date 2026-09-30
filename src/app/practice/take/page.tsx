"use client";

import { QuizEngine } from "@/components/QuizEngine";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { practiceMessages } from "@/lib/i18n/ns/practice";
import { pickTitle } from "@/lib/i18n/pick";
import { getTopicBank } from "@/lib/topicBanks";
import type { ExamPaper, QuizQuestion } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function TakeQuizInner() {
  const { locale } = useI18n();
  const t = practiceMessages[locale].take;
  const search = useSearchParams();
  const bankId = search.get("bank") ?? "";
  const lessonIdParam = search.get("lessonId") ?? "grade-12-ch1";
  const requestedMode = search.get("mode") ?? "free";
  const mode = requestedMode === "contest" || requestedMode === "exam" ? requestedMode : "free";
  const examId = search.get("examId");
  const bank = bankId ? getTopicBank(bankId) : undefined;
  const lessonId = bank ? `bank:${bank.id}` : lessonIdParam;
  const [name, setName] = useState<string>(t.defaultName);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [exam, setExam] = useState<ExamPaper | null>(null);
  const [loadError, setLoadError] = useState(false);

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
    let cancelled = false;
    setLoadError(false);
    void (async () => {
      try {
        const response = await fetch(`/api/quiz?${query.toString()}`);
        const data = (await response.json()) as { questions?: QuizQuestion[]; exam?: ExamPaper };
        if (cancelled) return;
        setQuestions(data.questions ?? []);
        setExam(data.exam ?? null);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonIdParam, examId, bankId, mode]);

  const timed = mode === "exam" || mode === "contest";
  const duration = exam?.durationMinutes || (mode === "contest" ? (bank?.contestMinutes ?? 25) : 15);
  const passScore = exam?.passScore ?? bank?.passScore ?? 70;
  const heading = exam
    ? pickTitle(locale, { title: exam.title, arabicTitle: exam.arabicTitle ?? "" })
    : mode === "contest" && bank
      ? fmt(t.contestTitle, { title: pickTitle(locale, bank) })
      : mode === "exam"
        ? t.exam
        : t.free;

  return (
    <main className="shell">
      <p className="eyebrow">{mode === "contest" ? t.contestEyebrow : timed ? t.exam : t.free}</p>
      <h1>{heading}</h1>
      {bank ? (
        <p className="muted">
          {fmt(t.bankMeta, {
            cert: bank.certificate,
            slices: bank.slices.map((slice) => pickTitle(locale, slice)).join(locale === "ar" ? "، " : ", "),
            n: questions?.length ?? "…",
          })}
        </p>
      ) : null}
      <label>
        {t.name}
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
      ) : loadError ? (
        <p className="error" role="alert">
          {t.loadFailed}
        </p>
      ) : (
        <p className="muted">{t.preparing}</p>
      )}
    </main>
  );
}

function TakeFallback() {
  const t = useNs(practiceMessages).take;
  return <main className="shell">{t.loading}</main>;
}

export default function TakeQuizPage() {
  return (
    <Suspense fallback={<TakeFallback />}>
      <TakeQuizInner />
    </Suspense>
  );
}
