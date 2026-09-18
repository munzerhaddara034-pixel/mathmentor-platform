"use client";

import { MathTex } from "@/components/MathTex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import type { QuizQuestion } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function QuizPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId;
  const [name, setName] = useState("طالب");
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
      <main className="shell" dir="rtl">
        <p className="eyebrow">اختبار تكيّفي</p>
        <h1>{done.passed ? "نجحت — الدرس التالي مفتوح" : "أعد المحاولة للوصول إلى 70%"}</h1>
        <p className="muted">النتيجة: {done.score}٪</p>
        <div className="row">
          <Link className="btn dark" href={`/classroom/${lessonId}`}>
            العودة للدرس
          </Link>
          <Link className="btn" href="/leaderboard">
            لوحة الصدارة
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" dir="rtl">
      <p className="eyebrow">بنك الأسئلة · صعوبة {difficulty}</p>
      <h1>اختبار الدرس</h1>
      <label>
        اسمك للصدارة والعلامة المائية
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
              {picked === question.correctIndex ? "صحيح." : "الإجابة الصحيحة بالخطوات:"}
              {question.steps.map((step) => (
                <p key={step}>
                  <MixedMathText text={step} />
                </p>
              ))}
            </div>
          ) : (
            <button className="btn ok" type="button" style={{ marginTop: 16 }} onClick={submit} disabled={picked == null}>
              تصحيح تلقائي
            </button>
          )}
        </article>
      ) : (
        <p className="muted">جارٍ تحميل السؤال…</p>
      )}
    </main>
  );
}
