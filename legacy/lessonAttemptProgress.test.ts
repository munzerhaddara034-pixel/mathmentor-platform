import { describe, expect, it } from "vitest";
import { parseSolutionSteps } from "./examAttemptProgress";

describe("lesson attempt solution steps", () => {
  it("parses saved step arrays", () => {
    expect(parseSolutionSteps(JSON.stringify(["Substitute x = 3", "Calculate the output"]))).toEqual(["Substitute x = 3", "Calculate the output"]);
  });

  it("falls back safely for legacy plain text", () => {
    expect(parseSolutionSteps("Use the function rule")).toEqual(["Use the function rule"]);
  });

  it("ignores malformed or non-string step values", () => {
    expect(parseSolutionSteps("{bad json")).toEqual(["{bad json"]);
    expect(parseSolutionSteps(JSON.stringify(["valid", 7, null]))).toEqual(["valid"]);
    expect(parseSolutionSteps(" ")).toEqual([]);
  });
});
