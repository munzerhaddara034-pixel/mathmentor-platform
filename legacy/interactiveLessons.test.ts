import { describe, expect, it } from "vitest";
import { getInteractiveLesson, interactiveLessons } from "./interactiveLessons";

describe("expanded interactive lessons", () => {
  it("gives every lesson multiple examples and varied practice", () => {
    expect(interactiveLessons.length).toBeGreaterThanOrEqual(15);
    for (const lesson of interactiveLessons) {
      expect(lesson.examples?.length).toBeGreaterThanOrEqual(2);
      expect(lesson.practiceSet?.length).toBeGreaterThanOrEqual(3);
      for (const practice of lesson.practiceSet ?? []) {
        expect(practice.options).toContain(practice.answer);
        expect(["guided", "standard", "challenge"]).toContain(practice.difficulty);
        expect(practice.explanation.length).toBeGreaterThan(5);
        expect(practice.arabicExplanation.length).toBeGreaterThan(5);
      }
    }
  });

  it("keeps the requested skill available through the shared lookup", () => {
    const lesson = getInteractiveLesson("probability");
    expect(lesson.examples?.[1].question).toContain("bag");
    expect(lesson.practiceSet?.some((item) => item.difficulty === "guided")).toBe(true);
    expect(lesson.practiceSet?.some((item) => item.difficulty === "standard")).toBe(true);
    expect(lesson.practiceSet?.some((item) => item.difficulty === "challenge")).toBe(true);
  });
});
