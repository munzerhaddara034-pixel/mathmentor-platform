import type { ExamModel } from "./examModels";

export type ExamModelResult = {
  total: number;
  correct: number;
  unanswered: number;
  percentage: number;
  skillBreakdown: { skill: string; correct: number; total: number; percentage: number }[];
};

export function calculateExamModelResult(model: ExamModel, answers: Record<string, string>): ExamModelResult {
  const skillMap = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  let unanswered = 0;
  for (const question of model.questions) {
    const answer = answers[question.id];
    const bucket = skillMap.get(question.skill) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (answer === undefined || answer === "") unanswered += 1;
    if (answer === String(question.correctIndex)) { correct += 1; bucket.correct += 1; }
    skillMap.set(question.skill, bucket);
  }
  const total = model.questions.length;
  return { total, correct, unanswered, percentage: total ? Math.round((correct / total) * 100) : 0, skillBreakdown: Array.from(skillMap.entries()).map(([skill, value]) => ({ skill, ...value, percentage: Math.round((value.correct / value.total) * 100) })) };
}

export function getResultMessage(percentage: number) {
  if (percentage >= 80) return { en: "Strong performance. Keep extending your reasoning.", ar: "أداء قوي. واصل توسيع طريقة تفكيرك." };
  if (percentage >= 60) return { en: "A solid base with a few skills to reinforce.", ar: "أساس جيد مع بعض المهارات التي تحتاج إلى تعزيز." };
  return { en: "Use the skill notes to build a focused review plan.", ar: "استخدم ملاحظات المهارات لبناء خطة مراجعة مركزة." };
}
