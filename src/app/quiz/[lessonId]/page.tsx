"use client";

import { MathTex } from "@/components/MathTex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import type { QuizQuestion } from "@/lib/types";
import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { practiceMessages } from "@/lib/i18n/ns/practice";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuizPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;
  const { locale } = useI18n();
  const t = practiceMessages[locale].quiz;
  const [name, setName] = useState<string>(practiceMessages[locale].take.defaultName);
  const [loadError, setLoadError] = useState(false);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [asked, setAsked] = useState(0);
  const [done, setDone] = useState<{ passed: boolean; score: number } | null>(null);

  const load = async (usedIds: string[], last?: boolean, d: 1 | 2 | 3 = difficulty) => {
    const query = new URLSearchParams({
      lessonId,
      used: usedIds.join(","),
      d: String(d),
    });
    if (last != null) query.set("last", last ? "1" : "0");
    try {
      setLoadError(false);
      const response = await fetch(`/api/quiz?${query.toString()}`);
      const data = (await response.json()) as { question: QuizQuestion | null };
      setQuestion(data.question);
      setPicked(null);
      setRevealed(false);
      if (!data.question) {
        const score = asked === 0 ? 0 : Math.round((correctCount / asked) * 100);
        const save = await fetch("/api/quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId, score, studentName: name }),
        });
        const result = (await save.json()) as { passed: boolean };
        setDone({ passed: result.passed, score });
      }
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    void load([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  const submit = () => {
    if (picked == null || !question) return;
    const ok = picked === question.correctIndex;
    setRevealed(true);
    setAsked((value) => value + 1);
    if (ok) setCorrectCount((value) => value + 1);
    const nextDiff = (ok ? Math.min(3, difficulty + 1) : Math.max(1, difficulty - 1)) as 1 | 2 | 3;
    setDifficulty(nextDiff);
    const nextUsed = [...used, question.id];
    setUsed(nextUsed);
    window.setTimeout(() => {
      void load(nextUsed, ok, nextDiff);
    }, 2200);
  };

  if (done) {
    return (
      <main className="shell">
        <p className="eyebrow">{t.adaptive}</p>
        <h1>{done.passed ? t.passed : t.retry}</h1>
        <p className="muted">{fmt(t.result, { n: done.score })}</p>
        <div className="row">
          <Link className="btn dark" href={`/classroom/${lessonId}`}>
            {t.back}
          </Link>
          <Link className="btn" href="/leaderboard">
            {t.leaderboard}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <p className="eyebrow">{fmt(t.eyebrow, { n: difficulty })}</p>
      <h1>{t.title}</h1>
      <label>
        {t.name}
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      {question ? (
        <article className="card" style={{ marginTop: 16 }}>
          <p>
            <MixedMathText text={question.prompt} />
          </p>
          <MathTex tex={question.latex} />
          <div className="grid two">
            {question.options.map((option, index) => (
              <button
                key={option}
                className={`btn ${picked === index ? "dark" : ""}`}
                type="button"
                onClick={() => setPicked(index)}
                disabled={revealed}
              >
                <MixedMathText text={option} />
              </button>
            ))}
          </div>
          {revealed ? (
            <div className="paper" style={{ marginTop: 16 }}>
              {picked === question.correctIndex ? t.correct : t.stepsIntro}
              {question.steps.map((step) => (
                <p key={step}>
                  <MixedMathText text={step} />
                </p>
              ))}
            </div>
          ) : (
            <button className="btn ok" type="button" style={{ marginTop: 16 }} onClick={submit} disabled={picked == null}>
              {t.check}
            </button>
          )}
        </article>
      ) : loadError ? (
        <p className="error" role="alert">
          {t.loadFailed}
        </p>
      ) : (
        <p className="muted">{t.loading}</p>
      )}
    </main>
  );
}
