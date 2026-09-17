"use client";

import { InteractiveLessonPlayer } from "@/components/studio/InteractiveLessonPlayer";
import { Katex } from "@/components/studio/Katex";
import type { MathQueryRecord } from "@/lib/solver/types";
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

  useEffect(() => {
    setQuery(initial);
  }, [initial]);

  return (
    <div className="solver-result">
      <div className="card">
        <p className="eyebrow">{query.source === "demo" ? "Demo solver" : query.source}</p>
        <h2>{query.question}</h2>
        {query.imageUrl ? <img className="question-image" src={query.imageUrl} alt="" /> : null}
        <p>{query.summary}</p>
        <div className="final-box">
          <span className="muted">Final answer</span>
          <Katex tex={query.finalAnswerLatex || query.finalAnswer} display />
          <p>{query.finalAnswer}</p>
        </div>
        {query.warning ? <p className="muted">{query.warning}</p> : null}
        <ol className="solver-steps">
          {query.steps.map((step, index) => (
            <li key={`${step.title}-${index}`}>
              <strong>
                {index + 1}. {step.title}
              </strong>
              <Katex tex={step.latex} display />
              <p>{step.explanationEn}</p>
              {step.explanationFr ? <p className="muted">{step.explanationFr}</p> : null}
            </li>
          ))}
        </ol>
        <div className="row">
          <button className="btn dark" type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? "Generating…" : "Generate avatar explanation"}
          </button>
          <Link className="btn" href={`/lessons/interactive-explanation?id=${query.id}`}>
            Open split player
          </Link>
        </div>
        {notice ? <p className="success">{notice}</p> : null}
        <p className="muted">
          Video: {query.videoStatus}
          {query.heygenJobId ? ` · job ${query.heygenJobId}` : ""}
        </p>
      </div>
      <InteractiveLessonPlayer timeline={query.timeline} viewer={viewer} canTeach={canTeach} />
    </div>
  );
}
