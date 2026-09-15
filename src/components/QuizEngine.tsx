"use client";

import { MathTex } from "@/components/MathTex";
import type { ExamPackMeta, ExamPartSpec } from "@/lib/examCatalog";
import { difficultyLabel } from "@/lib/quizBank";
import type { QuizQuestion } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Result = {
  earned: number;
  totalPoints: number;
  score: number;
  percent: number;
  elapsedSec: number;
  passed: boolean;
  answers: (number | null)[];
};

function deriveParts(questions: QuizQuestion[], parts?: ExamPartSpec[]): ExamPartSpec[] {
  if (parts?.length) return parts;
  const seen: ExamPartSpec[] = [];
  for (const question of questions) {
    const id = question.partId;
    if (!id || seen.some((part) => part.id === id)) continue;
    const partQuestions = questions.filter((item) => item.partId === id);
    seen.push({
      id,
      roman: id,
      arabicLabel: question.partLabel ?? id,
      englishLabel: id,
      points: partQuestions.reduce((sum, item) => sum + (item.points ?? 1), 0),
    });
  }
  return seen;
}

export function QuizEngine({
  questions,
  timed,
  durationMinutes,
  passScore,
  studentName,
  lessonId,
  onSaved,
  parts,
  pack,
  printHref,
}: {
  questions: QuizQuestion[];
  timed: boolean;
  durationMinutes: number;
  passScore: number;
  studentName: string;
  lessonId: string;
  onSaved?: (passed: boolean, percent: number) => void;
  parts?: ExamPartSpec[];
  pack?: ExamPackMeta | null;
  printHref?: string;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [flagged, setFlagged] = useState<boolean[]>(() => questions.map(() => false));
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [startedAt] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const [activePart, setActivePart] = useState<string | "all">("all");
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const examParts = useMemo(() => deriveParts(questions, parts ?? pack?.parts), [questions, parts, pack?.parts]);
  const question = questions[index];
  const answered = answers.filter((item) => item != null).length;
  const percentDone = questions.length ? Math.round((answered / questions.length) * 100) : 0;
  const totalPoints = pack?.totalPoints || questions.reduce((sum, item) => sum + (item.points ?? 1), 0);
  const paperHref = printHref ?? (pack ? `/exams/print?pack=${encodeURIComponent(pack.id)}&mode=paper` : "");
  const solutionsHref = pack ? `/exams/print?pack=${encodeURIComponent(pack.id)}&mode=solutions` : paperHref;

  useEffect(() => {
    void window.MathJax?.typesetPromise?.();
  }, [index, question, result, activePart]);

  useEffect(() => {
    if (!timed || result) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          void finish(answersRef.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timed, result]);

  const finish = async (finalAnswers: (number | null)[]) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const earned = questions.reduce((sum, item, i) => {
      const pts = item.points ?? 1;
      return sum + (finalAnswers[i] === item.correctIndex ? pts : 0);
    }, 0);
    const correct = questions.filter((item, i) => finalAnswers[i] === item.correctIndex).length;
    const percent = totalPoints ? Math.round((earned / totalPoints) * 100) : 0;
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const passed = percent >= passScore;
    setResult({ earned, totalPoints, score: correct, percent, elapsedSec, passed, answers: finalAnswers });
    await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, score: percent, studentName, passScore }),
    });
    onSaved?.(passed, percent);
  };

  const clock = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  const openPrint = (href: string) => {
    if (!href) return;
    const popup = window.open(href, "exam-print", "width=900,height=1200");
    if (!popup) window.location.assign(href);
  };

  if (!questions.length) return <p className="muted">لا أسئلة في هذا الدرس بعد.</p>;

  if (result) {
    return (
      <section className="quiz-results" dir="rtl">
        <div className={`result-hero ${result.passed ? "pass" : "fail"}`}>
          <p className="eyebrow">{result.passed ? "أحسنت" : "حاول مرة أخرى"}</p>
          <h2>
            {result.earned} / {result.totalPoints}
            <span className="result-bareme-unit"> علامة</span>
          </h2>
          <p>
            الباريم {result.percent}% · {result.score} إجابة صحيحة من {questions.length} · الوقت{" "}
            {Math.floor(result.elapsedSec / 60)}:{String(result.elapsedSec % 60).padStart(2, "0")} · النجاح من {passScore}%
          </p>
        </div>
        {pack ? (
          <p className="muted exam-disclaimer-inline">{pack.disclaimer}</p>
        ) : null}
        <div className="row" style={{ marginTop: 12 }}>
          {paperHref ? (
            <button className="btn dark" type="button" onClick={() => openPrint(paperHref)}>
              تصدير ورقة الامتحان PDF
            </button>
          ) : null}
          {solutionsHref ? (
            <button className="btn" type="button" onClick={() => openPrint(solutionsHref)}>
              تصدير الحلول والباريم PDF
            </button>
          ) : null}
          <Link className="btn" href="/exams">
            بنك الامتحانات
          </Link>
        </div>

        {examParts.length ? (
          <table className="data-table bareme-table">
            <thead>
              <tr>
                <th>المسألة</th>
                <th>العلامة</th>
                <th>المستحق</th>
              </tr>
            </thead>
            <tbody>
              {examParts.map((part) => {
                const items = questions
                  .map((item, i) => ({ item, i }))
                  .filter(({ item }) => (item.partId ?? examParts[0]?.id) === part.id);
                const earned = items.reduce(
                  (sum, { item, i }) => sum + (result.answers[i] === item.correctIndex ? (item.points ?? 1) : 0),
                  0,
                );
                const max = items.reduce((sum, { item }) => sum + (item.points ?? 1), 0);
                return (
                  <tr key={part.id}>
                    <td>
                      {part.roman} — {part.arabicLabel}
                    </td>
                    <td>{max}</td>
                    <td>
                      {earned} / {max}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <strong>المجموع</strong>
                </td>
                <td>{result.totalPoints}</td>
                <td>
                  <strong>
                    {result.earned} / {result.totalPoints}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        ) : null}

        {questions.map((item, i) => {
          const picked = result.answers[i];
          const ok = picked === item.correctIndex;
          const pts = item.points ?? 1;
          return (
            <article className="card" key={item.id} style={{ marginTop: 12 }}>
              <div className="result-item-head">
                <span className={`badge ${ok ? "approved" : "rejected"}`}>{ok ? "صح" : "خطأ"}</span>
                {item.partLabel ? <span className="badge">{item.partLabel}</span> : null}
                <span className="badge">
                  الباريم {ok ? pts : 0} / {pts}
                </span>
              </div>
              <p>
                {i + 1}. {item.prompt}
              </p>
              <MathTex tex={item.latex} />
              <p className="muted">إجابتك: {picked == null ? "بدون إجابة" : item.options[picked]}</p>
              <p>الصحيح: {item.options[item.correctIndex]}</p>
              <div className="paper">
                <strong>خطوات الحل</strong>
                {(item.solution ?? item.steps).map((step) => (
                  <p key={step}>{step}</p>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  const visibleIndexes =
    activePart === "all"
      ? questions.map((_, i) => i)
      : questions.map((item, i) => ((item.partId ?? "") === activePart ? i : -1)).filter((i) => i >= 0);

  return (
    <section className="quiz-engine" dir="rtl">
      <div className="quiz-toolbar">
        <div className="progress-track">
          <span style={{ width: `${percentDone}%` }} />
        </div>
        <p className="muted">
          سؤال {index + 1} / {questions.length}
          {question ? ` · صعوبة ${difficultyLabel[question.difficulty]}` : ""} · أُجيب {answered}
          {timed ? ` · الوقت ${clock}` : " · تدريب حر"}
          {question?.points != null ? ` · ${question.points} عل.` : ""}
        </p>
        {examParts.length > 1 ? (
          <div className="exam-part-tabs">
            <button
              type="button"
              className={`exam-part-tab ${activePart === "all" ? "active" : ""}`}
              onClick={() => setActivePart("all")}
            >
              الكل
            </button>
            {examParts.map((part) => (
              <button
                key={part.id}
                type="button"
                className={`exam-part-tab ${activePart === part.id ? "active" : ""}`}
                onClick={() => {
                  setActivePart(part.id);
                  const first = questions.findIndex((item) => item.partId === part.id);
                  if (first >= 0) setIndex(first);
                }}
              >
                {part.arabicLabel}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {question ? (
        <article className="card">
          {question.partLabel ? (
            <p className="eyebrow">
              {question.partLabel}
              {question.points != null ? ` · ${question.points} علامات` : ""}
            </p>
          ) : null}
          <p style={{ fontSize: 20 }}>{question.prompt}</p>
          <MathTex tex={question.latex} />
          {question.imageUrl ? <img src={question.imageUrl} alt="" className="question-image" /> : null}
          <div className="option-grid">
            {question.options.map((option, optionIndex) => (
              <button
                key={`${question.id}-${optionIndex}`}
                type="button"
                className={`option-btn ${answers[index] === optionIndex ? "picked" : ""}`}
                onClick={() =>
                  setAnswers((rows) => {
                    const next = [...rows];
                    next[index] = optionIndex;
                    return next;
                  })
                }
              >
                {option}
              </button>
            ))}
          </div>
        </article>
      ) : null}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn" type="button" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
          السابق
        </button>
        <button
          className="btn"
          type="button"
          disabled={index >= questions.length - 1}
          onClick={() => setIndex((value) => value + 1)}
        >
          التالي
        </button>
        <button
          className="btn"
          type="button"
          onClick={() =>
            setFlagged((rows) => {
              const next = [...rows];
              next[index] = !next[index];
              return next;
            })
          }
        >
          {flagged[index] ? "أُزيل من المراجعة" : "مراجعة لاحقاً"}
        </button>
        {paperHref ? (
          <button className="btn" type="button" onClick={() => openPrint(paperHref)}>
            تصدير PDF
          </button>
        ) : null}
        <button className="btn ok" type="button" onClick={() => void finish(answers)}>
          تسليم الامتحان
        </button>
      </div>
      <div className="quiz-dots">
        {(visibleIndexes.length ? visibleIndexes : questions.map((_, i) => i)).map((i) => (
          <button
            key={questions[i]?.id ?? i}
            type="button"
            className={`dot ${i === index ? "current" : ""} ${answers[i] != null ? "done" : ""} ${flagged[i] ? "flag" : ""}`}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
