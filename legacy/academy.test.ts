import { describe, expect, it } from "vitest";
import { evaluateLinearEquationAnswer, hasPremiumAccess } from "./academy";

describe("academy learning helpers", () => {
  it("returns step-by-step feedback for the correct linear equation answer", () => {
    const result = evaluateLinearEquationAnswer("x = 5");
    expect(result.correct).toBe(true);
    expect(result.feedback).toContain("divide by 3");
  });

  it("gives a useful hint for an incorrect answer", () => {
    const result = evaluateLinearEquationAnswer("x = 3");
    expect(result.correct).toBe(false);
    expect(result.feedback).toContain("subtracting 5");
  });

  it("only grants premium access after manual approval", () => {
    expect(hasPremiumAccess("free")).toBe(false);
    expect(hasPremiumAccess("pending")).toBe(false);
    expect(hasPremiumAccess("active")).toBe(true);
  });
});
