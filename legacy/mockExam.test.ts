import { describe, expect, it } from "vitest";
import { calculateMockExamResult, grade9MockExam } from "../shared/mockExam";

describe("Grade 9 mock exam", () => {
  it("contains a complete, answerable question set", () => {
    expect(grade9MockExam.questions.length).toBeGreaterThanOrEqual(8);
    expect(grade9MockExam.durationSeconds).toBeGreaterThan(0);
    for (const question of grade9MockExam.questions) {
      expect(question.options[question.correctIndex]).toBeTruthy();
      expect(question.explanation.length).toBeGreaterThan(0);
      expect(question.arabicExplanation.length).toBeGreaterThan(0);
    }
  });

  it("calculates correct answers, unanswered questions, and percentage", () => {
    const answers = Object.fromEntries(grade9MockExam.questions.slice(0, 4).map((question) => [question.id, question.correctIndex]));
    const result = calculateMockExamResult(answers);
    expect(result).toEqual({ correct: 4, answered: 4, total: grade9MockExam.questions.length, percentage: 50 });
  });

  it("does not award points for an incorrect option", () => {
    const first = grade9MockExam.questions[0];
    const wrongIndex = first.correctIndex === 0 ? 1 : 0;
    const result = calculateMockExamResult({ [first.id]: wrongIndex });
    expect(result.correct).toBe(0);
    expect(result.answered).toBe(1);
    expect(result.percentage).toBe(0);
  });
});
