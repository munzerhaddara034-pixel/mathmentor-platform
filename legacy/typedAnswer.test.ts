import { describe, expect, it } from "vitest";
import { isTypedAnswerCorrect, normalizeTypedAnswer, type TypedPractice } from "./typedAnswer";

const probability: TypedPractice = {
  question: "P", arabicQuestion: "احتمال", answer: "0.5", acceptedAnswers: ["1/2", ".5"],
  explanation: "", arabicExplanation: "", difficulty: "guided", placeholder: "",
};

describe("typed answer validation", () => {
  it("normalizes common mathematical input formatting", () => {
    expect(normalizeTypedAnswer("  $1,200.00 ")).toBe("1200.00");
    expect(normalizeTypedAnswer("x²")).toBe("x²");
    expect(normalizeTypedAnswer("−3")).toBe("-3");
  });

  it("accepts equivalent numeric and fraction forms", () => {
    expect(isTypedAnswerCorrect("0.5000", probability)).toBe(true);
    expect(isTypedAnswerCorrect("1/2", probability)).toBe(true);
    expect(isTypedAnswerCorrect("", probability)).toBe(false);
    expect(isTypedAnswerCorrect("0.25", probability)).toBe(false);
  });
});
