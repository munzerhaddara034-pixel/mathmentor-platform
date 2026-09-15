import { describe, expect, it } from "vitest";
import { lebaneseLifeSciencesMathPackage } from "../shared/lifeSciencesMathPackage";

describe("Lebanese Life Sciences mathematics package", () => {
  it("contains the ordered branch lessons and review metadata", () => {
    expect(lebaneseLifeSciencesMathPackage.grade).toBe("S3LS");
    expect(lebaneseLifeSciencesMathPackage.branch).toBe("Life Sciences");
    expect(lebaneseLifeSciencesMathPackage.lessons.map((lesson) => lesson.id)).toEqual([
      "s3ls-functions-and-variation",
      "s3ls-probability-and-statistics",
      "s3ls-vectors-and-geometry",
      "s3ls-exam-strategy-and-modeling",
      "s3ls-integration-and-applications",
      "s3ls-logarithmic-exponential-models",
      "s3ls-counting-and-probability-models",
      "s3ls-linear-systems-and-parameters",
    ]);
    expect(lebaneseLifeSciencesMathPackage.reviewStatus).toMatch(/review required/i);
  });

  it("keeps every worked example and practice answer grounded in its steps", () => {
    for (const lesson of lebaneseLifeSciencesMathPackage.lessons) {
      expect(lesson.worked.steps.length).toBeGreaterThanOrEqual(2);
      expect(lesson.worked.answer.length).toBeGreaterThan(0);
      expect(lesson.practice.length).toBeGreaterThanOrEqual(2);
      for (const item of lesson.practice) {
        expect(item.options).toContain(item.answer);
        expect(item.steps.length).toBeGreaterThanOrEqual(1);
        expect(item.answer.length).toBeGreaterThan(0);
      }
    }
  });
});
