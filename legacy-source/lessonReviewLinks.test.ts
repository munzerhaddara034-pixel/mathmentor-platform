import { describe, expect, it } from "vitest";
import { getLessonReviewLink, lessonReviewEntries } from "./lessonReviewLinks";

describe("lesson review links", () => {
  it("provides a stable review route for every mapped skill", () => {
    expect(lessonReviewEntries.length).toBeGreaterThan(10);
    for (const entry of lessonReviewEntries) {
      expect(getLessonReviewLink(entry.skill).slug).toBe(entry.slug);
      expect(entry.summary.length).toBeGreaterThan(20);
      expect(entry.arabicSummary.length).toBeGreaterThan(10);
    }
  });

  it("falls back to a safe summary for an unmapped skill", () => {
    const fallback = getLessonReviewLink("New skill");
    expect(fallback.slug).toBe("certificate-revision");
    expect(fallback.title).toContain("New skill");
    expect(fallback.summary).toContain("key definitions");
  });
});
