"use client";

import { useEffect, useRef } from "react";
import type { DerivedCanvasState, LessonLanguage } from "@/lib/studio/timeline";
import { graphIsAnimating, pickText } from "@/lib/studio/timeline";
import { FunctionGraph } from "./FunctionGraph";
import { Katex } from "./Katex";

type Props = {
  state: DerivedCanvasState;
  language: LessonLanguage;
  currentTime: number;
};

export function MathCanvas({ state, language, currentTime }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const animating = graphIsAnimating(state, currentTime, 5);
  const graphProgress = state.graphStartedAt == null
    ? 1
    : Math.max(0.05, Math.min(1, (currentTime - state.graphStartedAt) / 5));

  useEffect(() => {
    boardRef.current?.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state.steps.length, state.equations.length]);

  return (
    <section className="studio-canvas-panel" aria-label={language === "ar" ? "السبورة الذكية" : "Smart board"}>
      <p className="eyebrow">{language === "ar" ? "السبورة الذكية" : "Dynamic math canvas"}</p>
      <h2>{language === "ar" ? "رسم · معادلات · خطوات" : "Graphs · equations · steps"}</h2>
      <div ref={boardRef} className={`studio-board ${animating ? "drawing" : ""}`}>
        {state.equations.length === 0 && !state.graph && state.steps.length === 0 ? (
          <p className="muted">{language === "ar" ? "بانتظار بداية الدرس…" : "Waiting for the lesson clock…"}</p>
        ) : null}

        {state.equations.map((equation, index) => (
          <article key={`eq-${index}`} className="studio-eq">
            {equation.caption ? <p className="eyebrow">{pickText(equation.caption, language)}</p> : null}
            <Katex tex={equation.latex} display />
          </article>
        ))}

        {state.graph ? (
          <FunctionGraph
            spec={state.graph}
            highlights={state.highlights}
            language={language}
            progress={graphProgress}
          />
        ) : null}

        {state.highlights
          .filter((item) => item.kind === "extrema" && typeof item.x !== "number")
          .map((item, index) =>
            item.label ? (
              <p key={`note-${index}`} className="studio-note extrema">
                {pickText(item.label, language)}
              </p>
            ) : null,
          )}

        {state.steps.length ? (
          <ol className="studio-steps">
            {state.steps.map((step, index) => (
              <li key={`st-${index}`} className={index === state.steps.length - 1 ? "current" : ""}>
                <span className="studio-step-index">{step.index}</span>
                <div>
                  {step.text ? <p>{pickText(step.text, language)}</p> : null}
                  {step.latex ? <Katex tex={step.latex} display /> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}
