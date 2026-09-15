import type { ExamModel } from "./examModels";
import type { ExamModelResult } from "./examModelResults";
import { getLessonReviewLink } from "./lessonReviewLinks";

export type ExamModelAttemptPayload = {
  examId: string;
  specialization: string;
  score: number;
  total: number;
  answered: number;
  percentage: number;
  durationSeconds: number;
  timeSpentSeconds: number;
  sectionSnapshot: string;
  skillSnapshot: string;
  reviewSnapshot: string;
};

export function buildExamModelAttemptPayload(model: ExamModel, answers: Record<string, string>, result: ExamModelResult): ExamModelAttemptPayload {
  const reviewSnapshot = model.questions.map((question) => ({
    id: question.id,
    skill: question.skill,
    lessonSlug: getLessonReviewLink(question.skill).slug,
    prompt: question.prompt,
    arabicPrompt: question.arabicPrompt,
    selectedAnswer: answers[question.id] === undefined ? undefined : question.options[Number(answers[question.id])],
    correctAnswer: question.options[question.correctIndex],
    isCorrect: answers[question.id] === String(question.correctIndex),
    explanation: question.explanation,
    arabicExplanation: question.arabicExplanation,
  }));

  return {
    examId: model.id,
    specialization: model.branch,
    score: result.correct,
    total: result.total,
    answered: result.total - result.unanswered,
    percentage: result.percentage,
    durationSeconds: model.durationMinutes * 60,
    timeSpentSeconds: 0,
    sectionSnapshot: JSON.stringify(model.sections),
    skillSnapshot: JSON.stringify(result.skillBreakdown),
    reviewSnapshot: JSON.stringify(reviewSnapshot),
  };
}
