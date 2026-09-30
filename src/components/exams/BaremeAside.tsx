"use client";

import { baremeStepsForSub, questionMarksTotal, sumSteps } from "@/lib/exams/bareme";
import type { ExamQuestion, ExamSubQuestion, SubGrade } from "@/lib/exams/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { examsMessages } from "@/lib/i18n/ns/exams";

type Props = {
  /** Single sub — compact mark ladder beside the prompt. */
  sub?: ExamSubQuestion;
  /** Whole question — sums all subs. */
  question?: ExamQuestion;
  /** After grading: awarded marks keyed by subId. */
  gradesBySub?: Record<string, SubGrade>;
  /** Compact vs expanded. */
  compact?: boolean;
};

function StepList({
  sub,
  awarded,
}: {
  sub: ExamSubQuestion;
  awarded?: number;
}) {
  const { locale } = useI18n();
  const t = examsMessages[locale].bareme;
  const steps = baremeStepsForSub(sub);
  const stepTotal = sumSteps(steps);
  return (
    <div className="mm-bareme-block" aria-label={fmt(t.label, { label: sub.label })}>
      <div className="mm-bareme-head">
        <span className="badge mm-bareme-badge">{fmt(t.badge, { label: sub.label })}</span>
        <strong className="mm-bareme-total">
          {awarded != null ? `${awarded} / ` : ""}
          {fmt(t.pts, { n: sub.marks })}
        </strong>
      </div>
      <ul className="mm-bareme-steps">
        {steps.map((step) => (
          <li key={step.id}>
            <span className="mm-bareme-step-marks">{step.marks}</span>
            <span>
              {locale === "ar" ? (
                <span className="mm-bareme-step-ar">{step.labelAr || step.labelEn}</span>
              ) : (
                <span className="mm-bareme-step-en">{step.labelEn}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {Math.abs(stepTotal - sub.marks) > 1e-9 ? (
        <p className="muted mm-bareme-warn">{fmt(t.warn, { sum: stepTotal, max: sub.marks })}</p>
      ) : null}
    </div>
  );
}

/**
 * Official mark distribution beside a question / sub so students can sum totals.
 */
export function BaremeAside({ sub, question, gradesBySub, compact = false }: Props) {
  const { locale } = useI18n();
  const t = examsMessages[locale].bareme;
  if (sub) {
    const grade = gradesBySub?.[sub.id];
    return (
      <aside className={`mm-bareme-aside${compact ? " compact" : ""}`}>
        <StepList sub={sub} awarded={grade?.awarded} />
      </aside>
    );
  }

  if (!question) return null;
  const qTotal = questionMarksTotal(question);
  const awardedSum = question.subs.reduce((sum, item) => {
    const g = gradesBySub?.[item.id];
    return sum + (g?.awarded ?? 0);
  }, 0);
  const hasGrades = Boolean(gradesBySub && Object.keys(gradesBySub).length);

  return (
    <aside className={`mm-bareme-aside mm-bareme-question${compact ? " compact" : ""}`}>
      <div className="mm-bareme-head">
        <span className="badge mm-bareme-badge">{t.question}</span>
        <strong className="mm-bareme-total">
          {hasGrades ? `${awardedSum} / ` : ""}
          {fmt(t.pts, { n: qTotal })}
        </strong>
      </div>
      {question.subs.map((item) => (
        <StepList key={item.id} sub={item} awarded={gradesBySub?.[item.id]?.awarded} />
      ))}
    </aside>
  );
}
