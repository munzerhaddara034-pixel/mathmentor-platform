import { describe, expect, it } from "vitest";
import { pilotLesson } from "../shared/pilotLesson";

describe("pilot lesson content", () => {
  it("contains a complete Grade 9 linear-equations explanation", () => {
    expect(pilotLesson.track).toBe("Grade 9 Certificate");
    expect(pilotLesson.workedExample.question).toBe("3x + 5 = 20");
    expect(pilotLesson.workedExample.answer).toBe("x = 5");
    expect(pilotLesson.steps).toHaveLength(4);
  });

  it("keeps challenge answers consistent with their explanations", () => {
    expect(pilotLesson.challenge).toHaveLength(3);
    for (const challenge of pilotLesson.challenge) {
      expect(challenge.options).toContain(challenge.answer);
      expect(challenge.explanation.length).toBeGreaterThan(10);
    }
  });
});
