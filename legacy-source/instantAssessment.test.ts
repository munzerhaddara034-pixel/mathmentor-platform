import { describe, expect, it } from "vitest";
import { evaluateAssessmentAnswer, getAssessmentSummary } from "../shared/instantAssessment";

describe("instant assessment", () => {
  const question = {
    prompt: "Solve 2x + 4 = 10.",
    options: ["2", "3", "4"],
    answer: "3",
    steps: ["Subtract 4 from both sides.", "Divide by 2."],
  } as const;

  it("returns immediate correct feedback and progress", () => {
    const result = evaluateAssessmentAnswer(question, "3", 1, 2);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(1);
    expect(result.progress).toBe(50);
    expect(result.explanation).toContain("Subtract 4");
  });

  it("returns explanatory feedback for an incorrect answer", () => {
    const result = evaluateAssessmentAnswer(question, "4", 1, 2);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.explanation).toContain("Divide by 2");
  });

  it("summarizes completion and percentage", () => {
    expect(getAssessmentSummary([true, false, true], 3)).toEqual({
      correct: 2,
      total: 3,
      percentage: 67,
      completed: true,
    });
  });
});
