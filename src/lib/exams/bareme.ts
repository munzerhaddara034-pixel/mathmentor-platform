/**
 * Official mark distribution (Barème / سلّم التصحيح) for exam simulations.
 * Branding: Prof. Munzer Haddara / الأستاذ منذر حداره — never Al-Tarah / الطارة.
 */

import type { BaremeStep, ExamQuestion, ExamSubQuestion, OfficialPaper } from "./types";

export type { BaremeStep };

export type BaremeRow = {
  subId: string;
  label: string;
  max: number;
  steps: BaremeStep[];
};

/** Prefer explicit `sub.bareme`; otherwise derive one step from rubric / marks. */
export function baremeStepsForSub(sub: ExamSubQuestion): BaremeStep[] {
  if (sub.bareme && sub.bareme.length > 0) {
    return sub.bareme;
  }
  const rubric = sub.rubric?.trim();
  return [
    {
      id: `${sub.id}-full`,
      labelEn: rubric || `Full credit for ${sub.label}`,
      labelAr: rubric ? `سلّم: ${sub.label}` : `العلامة الكاملة لـ ${sub.label}`,
      marks: sub.marks,
    },
  ];
}

export function baremeRowsForQuestion(question: ExamQuestion): BaremeRow[] {
  return question.subs.map((sub) => ({
    subId: sub.id,
    label: sub.label,
    max: sub.marks,
    steps: baremeStepsForSub(sub),
  }));
}

export function sumSteps(steps: BaremeStep[]): number {
  return steps.reduce((sum, step) => sum + step.marks, 0);
}

export function questionMarksTotal(question: ExamQuestion): number {
  return question.subs.reduce((sum, sub) => sum + sub.marks, 0);
}

export function paperBaremeSummary(paper: OfficialPaper): {
  totalMarks: number;
  subCount: number;
  rows: BaremeRow[];
} {
  const rows = paper.parts.flatMap((part) =>
    part.questions.flatMap((question) => baremeRowsForQuestion(question)),
  );
  return {
    totalMarks: paper.totalMarks,
    subCount: rows.length,
    rows,
  };
}

/** Soft assert: step marks should equal sub.marks (used in docs / tests). */
export function baremeStepsMatchSub(sub: ExamSubQuestion): boolean {
  const steps = baremeStepsForSub(sub);
  const total = sumSteps(steps);
  return Math.abs(total - sub.marks) < 1e-9;
}
