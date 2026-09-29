"use client";

import { MathTex } from "@/components/MathTex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { difficultyLabel } from "@/lib/quizBank";
import type { QuizQuestion } from "@/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";

type Result = {
  score: number;
  percent: number;
  elapsedSec: number;
  passed: boolean;
  answers: (number | null)[];
};

export function QuizEngine({
  questions,
  timed,
  durationMinutes,
  passScore,
  studentName,
  lessonId,
  onSaved,
}: {
  questions: QuizQuestion[];
  timed: boolean;
  durationMinutes: number;
  passScore: number;
  studentName: string;
  lessonId: string;
  onSaved?: (passed: boolean, percent: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [flagged, setFlagged] = useState<boolean[]>(() => questions.map(() => false));
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [startedAt] = useState(() => Date.now());
  const [result, setResult] = useState<Result | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const submittedRef = useRef(false);

  const question = questions[index];
  const answered = answers.filter((item) => item != null).length;
  const percentDone = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  useEffect(() => {
    void window.MathJax?.typesetPromise?.();
  }, [index, question, result]);

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
    const correct = questions.filter((item, i) => finalAnswers[i] === item.correctIndex).length;
    const percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    const passed = percent >= passScore;
    setResult({ score: correct, percent, elapsedSec, passed, answers: finalAnswers });
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

  if (!questions.length) return <p className="muted">لا أسئلة في هذا الدرس بعد.</p>;

  if (result) {
    return (
      <section className="quiz-results" dir="rtl">
        <div className={`result-hero ${result.passed ? "pass" : "fail"}`}>
          <p className="eyebrow">{result.passed ? "أحسنت" : "حاول مرة أخرى"}</p>
          <h2>
            {result.score} / {questions.length}
          </h2>
          <p>
            النسبة {result.percent}% · الوقت {Math.floor(result.elapsedSec / 60)}:{String(result.elapsedSec % 60).padStart(2, "0")} · النجاح من {passScore}%
          </p>
        </div>
        {questions.map((item, i) => {
          const picked = result.answers[i];
          const ok = picked === item.correctIndex;
          return (
            <article className="card" key={item.id} style={{ marginTop: 12 }}>
              <span className={`badge ${ok ? "approved" : "rejected"}`}>{ok ? "صح" : "خطأ"}</span>
              <p>
                {i + 1}. <MixedMathText text={item.prompt} />
              </p>
              <MathTex tex={item.latex} />
              <p className="muted">
                إجابتك: {picked == null ? "بدون إجابة" : <MixedMathText text={item.options[picked]} />}
              </p>
              <p>
                الصحيح: <MixedMathText text={item.options[item.correctIndex]} />
              </p>
              <div className="paper">
                <strong>خطوات الحل</strong>
                {item.steps.map((step) => (
                  <p key={step}>
                    <MixedMathText text={step} />
                  </p>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    );
  }

  return (
    <section className="quiz-engine" dir="rtl">
      <div className="quiz-toolbar">
        <div className="progress-track">
          <span style={{ width: `${percentDone}%` }} />
        </div>
        <p className="muted">
          سؤال {index + 1} / {questions.length} · صعوبة {difficultyLabel[question.difficulty]} · أُجيب {answered}
          {timed ? ` · الوقت ${clock}` : " · تدريب حر"}
        </p>
      </div>
      <article className="card">
        <p style={{ fontSize: 20 }}>
          <MixedMathText text={question.prompt} />
        </p>
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
              <MixedMathText text={option} />
            </button>
          ))}
        </div>
      </article>
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
        <button className="btn ok" type="button" onClick={() => void finish(answers)}>
          تسليم الامتحان
        </button>
      </div>
      <div className="quiz-dots">
        {questions.map((item, i) => (
          <button
            key={item.id}
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
