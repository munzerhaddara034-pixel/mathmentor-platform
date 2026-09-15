export type AssessmentQuestion = {
  id?: string;
  prompt: string;
  options: readonly string[];
  answer: string;
  explanation?: string;
  steps?: readonly string[];
};

export type AssessmentFeedback = {
  correct: boolean;
  score: number;
  total: number;
  progress: number;
  explanation: string;
};

export function evaluateAssessmentAnswer(
  question: AssessmentQuestion,
  selected: string,
  answeredCount: number,
  totalQuestions: number,
): AssessmentFeedback {
  const total = Math.max(1, totalQuestions);
  const correct = selected === question.answer;
  const score = correct ? 1 : 0;
  const progress = Math.min(100, Math.round((Math.max(0, answeredCount) / total) * 100));
  return { correct, score, total, progress, explanation: question.explanation ?? question.steps?.join(" ") ?? "Review the worked method and try again." };
}

export function getAssessmentSummary(
  results: readonly boolean[],
  totalQuestions: number,
) {
  const total = Math.max(0, totalQuestions);
  const correct = results.filter(Boolean).length;
  return {
    correct,
    total,
    percentage: total === 0 ? 0 : Math.round((correct / total) * 100),
    completed: results.length >= total && total > 0,
  };
}
