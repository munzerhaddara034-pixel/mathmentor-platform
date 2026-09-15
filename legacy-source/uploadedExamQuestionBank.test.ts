import { describe, expect, it } from "vitest";
import { filterBankQuestions, uploadedExamQuestionBank } from "../shared/uploadedExamQuestionBank";

describe("uploaded-exam-inspired question bank", () => {
  it("keeps every original question answerable and explained in both languages", () => {
    expect(uploadedExamQuestionBank.length).toBeGreaterThanOrEqual(10);
    for (const question of uploadedExamQuestionBank) {
      expect(question.options[question.correctIndex]).toBeTruthy();
      expect(question.explanation).toContain(".");
      expect(question.arabicExplanation.length).toBeGreaterThan(0);
      expect(question.patternSource.length).toBeGreaterThan(0);
    }
  });

  it("filters by grade and branch without mixing unrelated records", () => {
    const lifeSciences = filterBankQuestions("Grade 12", "Life Sciences");
    expect(lifeSciences.length).toBeGreaterThan(0);
    expect(lifeSciences.every((question) => question.grade === "Grade 12" && question.branch === "Life Sciences")).toBe(true);

    const grade9 = filterBankQuestions("Grade 9");
    expect(grade9.length).toBe(2);
    expect(grade9.every((question) => question.grade === "Grade 9")).toBe(true);
  });
});
