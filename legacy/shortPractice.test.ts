import { describe, expect, it } from "vitest";
import { getLessonReviewLink } from "./lessonReviewLinks";
import { getShortPracticeQuestions, getSkillForPracticeSlug } from "./shortPractice";

describe("short skill practice", () => {
  it("resolves a lesson slug to its skill and returns bank-backed questions", () => {
    const skill = getSkillForPracticeSlug("derivatives");
    const questions = getShortPracticeQuestions(skill);
    expect(skill).toBe("Derivatives");
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.some((question) => question.kind === "typed")).toBe(true);
    expect(questions.every((question) => question.kind === "typed" ? question.acceptedAnswers.length > 0 : question.options.length >= 2 && question.correctIndex >= 0)).toBe(true);
  });

  it("keeps a safe route for a skill with no direct bank match", () => {
    const link = getLessonReviewLink("Unknown skill");
    const questions = getShortPracticeQuestions("Unknown skill");
    expect(link.slug).toBe("certificate-revision");
    expect(questions).toEqual([]);
  });
});
