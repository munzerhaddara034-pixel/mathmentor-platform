"use client";

import { useEffect, useRef } from "react";
import type { DerivedCanvasState } from "@/lib/studio/timeline";
import type { LessonLanguage, LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import { FunctionGraph } from "./FunctionGraph";
import { DesmosGraph } from "./DesmosGraph";
import { Katex } from "./Katex";
import { IdentityWatermark } from "./IdentityWatermark";
import { hasDesmosKey } from "@/lib/studio/desmos";

type Props = {
  state: DerivedCanvasState;
  language: LessonLocale;
  /** Board chrome language (header / waiting); board content stays in `language`. */
  uiLanguage?: LessonLanguage;
  currentTime: number;
  watermarkName?: string;
  watermarkPhone?: string;
};

export function MathCanvas({ state, language, uiLanguage, currentTime, watermarkName, watermarkPhone }: Props) {
  const ui = uiLanguage ?? language;
  const uiDir = ui === "ar" ? "rtl" : undefined;
  const boardRef = useRef<HTMLDivElement>(null);
  const graphProgress =
    state.graphStartedAt == null ? 1 : Math.max(0.2, Math.min(1, (currentTime - state.graphStartedAt) / 1.8));

  useEffect(() => {
    // Scroll inside the board only; scrollIntoView would also scroll the page (jumps on phones).
    const board = boardRef.current;
    if (board && board.scrollHeight > board.clientHeight) board.scrollTo({ top: board.scrollHeight, behavior: "smooth" });
  }, [state.steps.length, state.equations.length, state.graph]);

  return (
    <section
      className="studio-canvas-panel"
      aria-label={pickText(STUDIO_UI.canvas, ui)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="eyebrow" dir={uiDir}>
        {pickText(STUDIO_UI.canvas, ui)}
      </p>
      <h2 dir={uiDir}>{pickText(STUDIO_UI.canvasSub, ui)}</h2>
      <div ref={boardRef} className="studio-board">
        <IdentityWatermark name={watermarkName ?? ""} phone={watermarkPhone ?? "76532421"} variant="light" />
        {state.equations.length === 0 && !state.graph && state.steps.length === 0 && state.examTips.length === 0 ? (
          <p className="muted" dir={uiDir}>
            {pickText(STUDIO_UI.waiting, ui)}
          </p>
        ) : null}

        {state.examTips.length ? (
          <aside className="studio-exam-tip" aria-label={pickText(STUDIO_UI.keyIdea, ui)}>
            <p className="eyebrow">{pickText(STUDIO_UI.keyIdea, ui)}</p>
            {state.examTips.map((tip, index) => (
              <div key={`tip-${tip.appearedAt}-${index}`}>
                {tip.text ? <p>{pickText(tip.text, language)}</p> : null}
                {tip.latex ? <Katex tex={tip.latex} display /> : null}
              </div>
            ))}
          </aside>
        ) : null}

        {state.equations.map((equation) => (
          <article
            key={`eq-${equation.appearedAt}-${equation.latex}`}
            className={`studio-eq ${equation.fade ? "studio-eq-fade" : ""}`}
          >
            {equation.caption ? <p className="eyebrow">{pickText(equation.caption, language)}</p> : null}
            <Katex tex={equation.latex} display />
          </article>
        ))}

        {state.graph ? (
          hasDesmosKey() ? (
            <DesmosGraph spec={state.graph} highlights={state.highlights} language={language} progress={graphProgress} />
          ) : (
            <FunctionGraph spec={state.graph} highlights={state.highlights} language={language} progress={graphProgress} />
          )
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
              <li
                key={`st-${step.appearedAt}-${step.index}`}
                className={`${index === state.steps.length - 1 ? "current" : ""} studio-eq-fade${step.boxed || step.kind === "boxed" ? " studio-step-boxed" : ""}${step.kind === "variation" ? " studio-step-variation" : ""}`}
              >
                <span className="studio-step-index">{step.index}</span>
                <div>
                  {step.text ? <p>{pickText(step.text, language)}</p> : null}
                  {step.latex ? <Katex tex={step.latex} display /> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {state.variationTables.length ? (
          <section className="studio-variation" aria-label={pickText(STUDIO_UI.variationTable, ui)}>
            <p className="eyebrow">{pickText(STUDIO_UI.variationTable, ui)}</p>
            {state.variationTables.map((table, index) => (
              <div key={`var-${table.appearedAt}-${index}`}>
                {table.text ? <p>{pickText(table.text, language)}</p> : null}
                {table.latex ? <Katex tex={table.latex} display /> : null}
              </div>
            ))}
          </section>
        ) : null}

        {state.boxedAnswers.length ? (
          <section className="studio-boxed-answer" aria-label={pickText(STUDIO_UI.boxedAnswer, ui)}>
            <p className="eyebrow">{pickText(STUDIO_UI.boxedAnswerMarks, ui)}</p>
            {state.boxedAnswers.map((box, index) => (
              <article key={`box-${box.appearedAt}-${index}`}>
                {box.marks ? <p className="muted">{box.marks}</p> : null}
                {box.text ? <p>{pickText(box.text, language)}</p> : null}
                {box.latex ? <Katex tex={box.latex} display /> : null}
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </section>
  );
}
