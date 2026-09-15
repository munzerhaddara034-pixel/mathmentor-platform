import { describe, expect, it } from "vitest";
import { calculateGrade12MiniMockExamResult, grade12MiniMockExam } from "./mockExam";

describe("Grade 12 mini mock exam", () => {
  it("uses six current question-bank items", () => {
    expect(grade12MiniMockExam.questions).toHaveLength(6);
    expect(grade12MiniMockExam.questions.every((question) => question.grade === "Grade 12")).toBe(true);
    expect(grade12MiniMockExam.questions.every((question) => question.prompt && question.arabicPrompt)).toBe(true);
    expect(grade12MiniMockExam.durationSeconds).toBe(12 * 60);
  });

  it("calculates correct, unanswered, and percentage values", () => {
    const answers = Object.fromEntries(grade12MiniMockExam.questions.slice(0, 3).map((question) => [question.id, question.correctIndex]));
    expect(calculateGrade12MiniMockExamResult(answers)).toEqual({ correct: 3, answered: 3, total: 6, percentage: 50 });
  });

  it("returns zero for an untouched attempt", () => {
    expect(calculateGrade12MiniMockExamResult({})).toEqual({ correct: 0, answered: 0, total: 6, percentage: 0 });
  });
});
