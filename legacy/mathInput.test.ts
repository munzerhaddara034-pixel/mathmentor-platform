import { describe, expect, it } from "vitest";
import { insertMathToken, mathKeyTokens } from "./mathInput";

describe("math input keypad", () => {
  it("inserts a token at the caret and returns the new caret", () => {
    expect(insertMathToken("x+1", 1, 1, "^2")).toEqual({ value: "x^2+1", caret: 3 });
  });

  it("replaces the selected range", () => {
    expect(insertMathToken("12", 0, 2, "()/()")).toEqual({ value: "()/()", caret: 5 });
  });

  it("provides core fraction and notation keys", () => {
    expect(mathKeyTokens.map((item) => item.token)).toEqual(expect.arrayContaining(["()/()", "^", "√()", "π", "≤", "≥"]));
  });
});
