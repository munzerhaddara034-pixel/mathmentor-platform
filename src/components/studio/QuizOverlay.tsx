"use client";

import { useState } from "react";
import type { LessonLocale } from "@/lib/studio/i18n";
import { pickText, STUDIO_UI } from "@/lib/studio/i18n";
import type { QuizMcq } from "@/lib/studio/quiz";
import { Katex } from "./Katex";

function maybeKatex(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length > 2) {
    return <Katex tex={trimmed.slice(1, -1)} />;
  }
  if (/[\\^_{}]/.test(trimmed) && /\\[a-zA-Z]+|{/.test(trimmed)) {
    return <Katex tex={trimmed} />;
  }
  return text;
}

export function QuizOverlay({
  quiz,
  language,
  onResolved,
}: {
  quiz: QuizMcq;
  language: LessonLocale;
  onResolved: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const correct = picked === quiz.correctId;
  const canContinue = (checked && correct) || revealed;

  const check = () => {
    if (!picked) return;
    setChecked(true);
    if (picked === quiz.correctId) setRevealed(false);
  };

  return (
    <div className="studio-quiz-overlay" role="dialog" aria-modal="true" aria-labelledby="studio-quiz-title">
      <div className="studio-quiz-card">
        <p className="eyebrow">{pickText(STUDIO_UI.quizEyebrow, language)}</p>
        <h2 id="studio-quiz-title">{maybeKatex(pickText(quiz.question, language))}</h2>
        <p className="muted studio-quiz-rule">{pickText(STUDIO_UI.quizRule, language)}</p>
        <div className="studio-quiz-choices" role="radiogroup">
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
                <span>{maybeKatex(pickText(choice.text, language))}</span>
              </button>
            );
          })}
        </div>
        {checked && !correct && !revealed ? (
          <p className="studio-quiz-feedback wrong">{pickText(STUDIO_UI.quizWrong, language)}</p>
        ) : null}
        {checked && correct ? <p className="studio-quiz-feedback ok">{pickText(STUDIO_UI.quizRight, language)}</p> : null}
        {revealed && quiz.explanation ? (
          <div className="studio-quiz-solution">
            <p className="eyebrow">{pickText(STUDIO_UI.quizSolution, language)}</p>
            <p>{maybeKatex(pickText(quiz.explanation, language))}</p>
          </div>
        ) : null}
        <div className="studio-quiz-actions">
          <button className="btn dark" type="button" onClick={check} disabled={!picked || canContinue}>
            {pickText(STUDIO_UI.quizCheck, language)}
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => setRevealed(true)}
            disabled={canContinue && correct}
          >
            {pickText(STUDIO_UI.quizShowSolution, language)}
          </button>
          <button className="btn ok" type="button" onClick={onResolved} disabled={!canContinue}>
            {pickText(STUDIO_UI.quizContinue, language)}
          </button>
        </div>
      </div>
    </div>
  );
}
