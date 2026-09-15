import { describe, expect, it } from "vitest";
import { grade12SpecializationExams } from "./mockExam";
import { parseReviewSnapshot, parseSkillSnapshot, serializeExamSections } from "./examAttemptProgress";

describe("exam attempt progress snapshots", () => {
  it("serializes section metadata without question text", () => {
    const sections = grade12SpecializationExams["Sociology and Economics"].sections;
    const parsed = JSON.parse(serializeExamSections(sections)) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toMatchObject({ questionCount: 5, durationSeconds: 480 });
    expect(parsed[0]).not.toHaveProperty("prompt");
  });

  it("parses question-level review snapshots and rejects malformed values", () => {
    const review = [{ id: "q1", skill: "Statistics", prompt: "What is the mean?", arabicPrompt: "ما المتوسط؟", selectedIndex: 0, selectedAnswer: "2", correctIndex: 1, correctAnswer: "3", explanation: "Add and divide.", arabicExplanation: "اجمع واقسم.", isCorrect: false }];
    expect(parseReviewSnapshot(JSON.stringify(review))).toMatchObject([{ id: "q1", selectedAnswer: "2", correctAnswer: "3", isCorrect: false }]);
    expect(parseReviewSnapshot("not-json")).toEqual([]);
    expect(parseReviewSnapshot(JSON.stringify([{ id: "q2", skill: "Missing explanation" }]))).toEqual([]);
  });

  it("parses valid skill snapshots and rejects malformed values", () => {
    expect(parseSkillSnapshot(JSON.stringify([{ skill: "Statistics", correct: 2, total: 3, percentage: 67, status: "developing" }]))).toHaveLength(1);
    expect(parseSkillSnapshot("not-json")).toEqual([]);
    expect(parseSkillSnapshot(JSON.stringify([{ skill: "missing totals" }]))).toEqual([]);
  });
});
