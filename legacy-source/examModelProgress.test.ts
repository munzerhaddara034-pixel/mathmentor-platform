import { describe, expect, it } from "vitest";
import { examModels } from "./examModels";
import { calculateExamModelResult } from "./examModelResults";
import { buildExamModelAttemptPayload } from "./examModelProgress";
import { getLessonReviewLink } from "./lessonReviewLinks";

describe("independent exam progress payload", () => {
  it("preserves the model identity, score, skills, sections, and question review", () => {
    const model = examModels[0];
    const answers = Object.fromEntries(model.questions.map((question, index) => [question.id, String(index === 0 ? question.correctIndex : -1)]));
    const result = calculateExamModelResult(model, answers);
    const payload = buildExamModelAttemptPayload(model, answers, result);

    expect(payload.examId).toBe(model.id);
    expect(payload.specialization).toBe(model.branch);
    expect(payload.total).toBe(model.questions.length);
    expect(payload.answered).toBe(model.questions.length);
    expect(JSON.parse(payload.sectionSnapshot)).toHaveLength(model.sections.length);
    expect(JSON.parse(payload.skillSnapshot)).toEqual(result.skillBreakdown);
    const review = JSON.parse(payload.reviewSnapshot) as { skill: string; lessonSlug: string }[];
    expect(review).toHaveLength(model.questions.length);
    expect(review.every((item) => item.lessonSlug === getLessonReviewLink(item.skill).slug)).toBe(true);
  });

  it("stores unanswered questions without inventing a selected answer", () => {
    const model = examModels.find((item) => item.id === "sat-math-model-1")!;
    const result = calculateExamModelResult(model, {});
    const payload = buildExamModelAttemptPayload(model, {}, result);
    const review = JSON.parse(payload.reviewSnapshot) as { selectedAnswer?: string; isCorrect: boolean }[];

    expect(payload.answered).toBe(0);
    expect(review.every((item) => item.selectedAnswer === undefined && !item.isCorrect)).toBe(true);
  });
});
