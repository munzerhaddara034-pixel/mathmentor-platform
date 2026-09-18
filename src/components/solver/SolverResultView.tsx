"use client";

import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import type { MathQueryRecord, StudentRating } from "@/lib/solver/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export function SolverResultView({
  initial,
  viewer,
  canTeach,
}: {
  initial: MathQueryRecord;
  viewer: { name: string; phone: string };
  canTeach: boolean;
}) {
  const [query, setQuery] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const generate = async () => {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/generate-avatar-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ queryId: query.id }),
    });
    const payload = (await response.json()) as { notice?: string; error?: string; demoMode?: boolean };
    setNotice(payload.notice || payload.error || (payload.demoMode ? "Demo video ready." : "Job queued."));
    const refresh = await fetch(`/api/solve-math/${query.id}`, { credentials: "same-origin" });
    const next = (await refresh.json()) as { query?: MathQueryRecord };
    if (next.query) setQuery(next.query);
    setBusy(false);
  };

  const rate = async (rating: StudentRating) => {
    const response = await fetch(`/api/solve-math/${query.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ rating }),
    });
    const payload = (await response.json()) as { query?: MathQueryRecord };
    if (payload.query) setQuery(payload.query);
  };

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  const given = query.given;
  const arabic = query.language === "ar";

  return (
    <div className="solver-result">
      <div className="card">
        <p className="eyebrow">{query.source === "demo" ? "Demo solver" : query.source}</p>
        <MixedMathText as="h2" text={query.question} />
        {query.imageUrl ? <img className="question-image" src={query.imageUrl} alt="" /> : null}

        {query.needsRetake ? (
          <div className="retake-banner" role="alert">
            <strong>Please rephotograph / صوّر من جديد</strong>
            <p>{query.retakeMessageEn}</p>
            <p dir="rtl" lang="ar">
              {query.retakeMessageAr}
            </p>
          </div>
        ) : null}

        <section className="exam-tip-box">
          <p className="eyebrow">Key Idea / Exam Tip · الفكرة الأساسية (before any calculation)</p>
          <p>{query.examTip?.en || query.summary}</p>
          {query.examTip?.fr ? <p className="muted">{query.examTip.fr}</p> : null}
          {query.examTip?.ar ? (
            <p dir="rtl" lang="ar">
              {query.examTip.ar}
            </p>
          ) : null}
        </section>

        <section className="given-box">
          <p className="eyebrow">a) Given &amp; Aim · المعطيات والمطلوب</p>
          {given ? <Katex tex={given.latex} display /> : <p>{query.question}</p>}
          <p>{given?.aimEn || query.summary}</p>
          {given?.aimFr ? <p className="muted">{given.aimFr}</p> : null}
          <p dir="rtl" lang="ar">
            {given?.aimAr}
          </p>
        </section>

        <section>
          <p className="eyebrow">b) Step-by-step · الحل المفصّل</p>
          <ol className="solver-steps">
            {query.steps.map((step, index) => (
              <li key={`${step.title}-${index}`}>
                <strong>
                  {index + 1}. {step.examVerbEn ? `${step.examVerbEn} / ${step.examVerbFr || ""} — ` : ""}
                  {arabic ? step.titleAr || step.title : step.title}
                </strong>
                <p className="theorem">
                  {step.theoremEn || step.title}
                  {step.theoremFr ? ` · ${step.theoremFr}` : ""}
                  {step.theoremAr ? ` · ${step.theoremAr}` : ""}
                </p>
                <Katex tex={step.latex} display />
                <p>{arabic ? step.explanationAr || step.explanationEn : step.explanationEn}</p>
                {!arabic && step.explanationFr ? <p className="muted">{step.explanationFr}</p> : null}
                {step.boxed ? <p className="solver-boxed-flag">Boxed Final Answer · إجابة مؤطّرة</p> : null}
                {!arabic && step.explanationAr ? (
                  <p className="muted" dir="rtl" lang="ar">
                    {step.explanationAr}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="final-box">
          <span className="muted">c) Final Answer Box · الناتج النهائي</span>
          <Katex tex={query.finalAnswerLatex || query.finalAnswer} display />
          <p>{query.finalAnswer}</p>
        </section>

        {query.warning && !query.needsRetake ? <p className="muted">{query.warning}</p> : null}

        <div className="rating-row">
          <span>Was this explanation correct?</span>
          <button
            type="button"
            className={query.rating === 1 ? "btn dark" : "btn"}
            onClick={() => void rate(1)}
            aria-pressed={query.rating === 1}
          >
            👍
          </button>
          <button
            type="button"
            className={query.rating === -1 ? "btn warn" : "btn"}
            onClick={() => void rate(-1)}
            aria-pressed={query.rating === -1}
          >
            👎
          </button>
        </div>

        {!query.needsRetake ? (
          <div className="row">
            <button className="btn dark" type="button" disabled={busy} onClick={() => void generate()}>
              {busy ? "Generating…" : "Generate avatar explanation"}
            </button>
            <Link className="btn" href={`/lessons/interactive-explanation?id=${query.id}`}>
              Open split player
            </Link>
          </div>
        ) : (
          <Link className="btn dark" href="/math-solver">
            New photo / سؤال جديد
          </Link>
        )}
        {notice ? <p className="success">{notice}</p> : null}
        <p className="muted">
          Video: {query.videoStatus}
          {query.heygenJobId ? ` · job ${query.heygenJobId}` : ""}
        </p>
      </div>
      {!query.needsRetake ? (
        <InteractiveLessonPlayer timeline={query.timeline} viewer={viewer} canTeach={canTeach} />
      ) : null}
    </div>
  );
}
