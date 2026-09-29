"use client";

import { Katex } from "@/components/studio/Katex";
import { MixedMathText } from "@/components/studio/MixedMathText";
import { ApiErrorBanner, SkeletonBlock } from "@/components/ui/Skeleton";
import type { GeneratedSimilarQuestion, GeneratedSimilarSet } from "@/lib/exams/types";
import { useState } from "react";

type Props = {
  paperId: string;
  questionId?: string;
  label?: string;
};

export function GenerateSimilarPanel({ paperId, questionId, label }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [errorAr, setErrorAr] = useState<string | undefined>();
  const [set, setResult] = useState<GeneratedSimilarSet | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const run = async (count = 3) => {
    setBusy(true);
    setError(undefined);
    setErrorAr(undefined);
    try {
      const response = await fetch("/api/exams/generate-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ paperId, questionId, count, save: true }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        set?: GeneratedSimilarSet;
        error?: string;
        errorAr?: string;
        note?: string;
      };
      if (!response.ok || !payload.set) {
        setError(payload.error || "Could not generate similar questions.");
        setErrorAr(payload.errorAr);
        return;
      }
      setResult(payload.set);
      setRevealed({});
    } catch {
      setError("Network error while generating similar questions.");
      setErrorAr("خطأ في الشبكة أثناء توليد أسئلة مشابهة.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gensim-panel" style={{ marginTop: 12 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="btn" type="button" disabled={busy} onClick={() => void run(3)}>
          {busy ? "Generating…" : label ?? "Generate similar (على نسقه)"}
        </button>
        {set ? (
          <span className="badge">{set.source === "demo" ? "Demo variants" : "LLM variants"}</span>
        ) : null}
      </div>
      <ApiErrorBanner error={error} errorAr={errorAr} />
      {busy ? <SkeletonBlock lines={4} label="Generating similar SAT items…" /> : null}
      {set ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted">
            Similar set {set.id} · {set.questions.length} items · saved for teacher review
          </p>
          {set.questions.map((q, index) => (
            <SimilarCard
              key={q.id}
              question={q}
              index={index + 1}
              revealed={Boolean(revealed[q.id])}
              onReveal={() => setRevealed((current) => ({ ...current, [q.id]: true }))}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SimilarCard({
  question,
  index,
  revealed,
  onReveal,
}: {
  question: GeneratedSimilarQuestion;
  index: number;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <article className="card" style={{ marginTop: 10 }}>
      <span className="badge">
        Similar {index} · {question.skill} · {question.responseType}
      </span>
      <p>
        <MixedMathText text={question.prompt} />
      </p>
      {question.latex ? <Katex tex={question.latex} display /> : null}
      {question.choices?.length ? (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {question.choices.map((choice) => (
            <li key={choice.id} style={{ marginBottom: 6 }}>
              <strong>{choice.id}.</strong> <MixedMathText text={choice.text} />
              {choice.latex ? (
                <>
                  {" "}
                  <Katex tex={choice.latex} />
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <button className="btn" type="button" onClick={onReveal}>
        {revealed ? "Answer shown" : "Show answer / solution"}
      </button>
      {revealed ? (
        <div style={{ marginTop: 8 }}>
          <p>
            <strong>Answer:</strong> {question.correctAnswer}
          </p>
          <p>
            <MixedMathText text={question.solution} />
          </p>
        </div>
      ) : null}
    </article>
  );
}
