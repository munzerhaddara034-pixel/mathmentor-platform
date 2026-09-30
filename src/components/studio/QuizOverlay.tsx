"use client";

import { useEffect, useId, useState } from "react";
import type { LessonLanguage, LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import type { QuizMcq } from "@/lib/studio/quiz";
import { MixedMathText } from "./MixedMathText";

export function QuizOverlay({
  quiz,
  language,
  uiLanguage,
  onResolved,
}: {
  quiz: QuizMcq;
  /** Question content language. */
  language: LessonLocale;
  /** Overlay chrome language (defaults to the content language). */
  uiLanguage?: LessonLanguage;
  onResolved: () => void;
}) {
  const titleId = useId();
  const ui = uiLanguage ?? language;
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const correct = picked === quiz.correctId;
  const canContinue = (checked && correct) || revealed;

  useEffect(() => {
    setPicked(null);
    setChecked(false);
    setRevealed(false);
  }, [quiz.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const check = () => {
    if (!picked) return;
    setChecked(true);
    if (picked === quiz.correctId) setRevealed(false);
  };

  return (
    <div className="studio-quiz-overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="studio-quiz-card" dir={ui === "ar" ? "rtl" : "ltr"} lang={ui}>
        <p className="eyebrow">{pickText(STUDIO_UI.quizEyebrow, ui)}</p>
        <h2 id={titleId} dir="ltr" lang={language}>
          <MixedMathText text={pickText(quiz.question, language)} />
        </h2>
        <p className="muted studio-quiz-rule">{pickText(STUDIO_UI.quizRule, ui)}</p>
        <div className="studio-quiz-choices" role="radiogroup" dir="ltr" lang={language}>
          {quiz.choices.map((choice) => {
            const selected = picked === choice.id;
            const showMark = revealed || (checked && selected);
            const isRight = choice.id === quiz.correctId;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`studio-quiz-choice ${selected ? "selected" : ""} ${showMark && isRight ? "correct" : ""} ${showMark && selected && !isRight ? "wrong" : ""}`}
                onClick={() => {
                  setPicked(choice.id);
                  setChecked(false);
                }}
                disabled={canContinue}
              >
                <span className="studio-quiz-letter">{choice.id.toUpperCase()}</span>
                <span>
                  <MixedMathText text={pickText(choice.text, language)} />
                </span>
              </button>
            );
          })}
        </div>
        {checked && !correct && !revealed ? (
          <p className="studio-quiz-feedback wrong">{pickText(STUDIO_UI.quizWrong, ui)}</p>
        ) : null}
        {checked && correct ? <p className="studio-quiz-feedback ok">{pickText(STUDIO_UI.quizRight, ui)}</p> : null}
        {revealed && quiz.explanation ? (
          <div className="studio-quiz-solution">
            <p className="eyebrow">{pickText(STUDIO_UI.quizSolution, ui)}</p>
            <p dir="ltr" lang={language}>
              <MixedMathText text={pickText(quiz.explanation, language)} />
            </p>
          </div>
        ) : null}
        <div className="studio-quiz-actions">
          <button className="btn dark" type="button" onClick={check} disabled={!picked || canContinue}>
            {pickText(STUDIO_UI.quizCheck, ui)}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setRevealed(true)}
            disabled={canContinue && correct}
          >
            {pickText(STUDIO_UI.quizShowSolution, ui)}
          </button>
          <button className="btn ok" type="button" onClick={onResolved} disabled={!canContinue}>
            {pickText(STUDIO_UI.quizContinue, ui)}
          </button>
        </div>
      </div>
    </div>
  );
}
