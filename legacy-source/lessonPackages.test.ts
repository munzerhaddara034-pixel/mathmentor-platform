import { describe, expect, it } from "vitest";
import { getRecommendedLessonPackages } from "../shared/lessonPackages";

describe("recommended lesson package links", () => {
  it("links active mathematics packs to real lesson targets", () => {
    const packs = getRecommendedLessonPackages("uae", "United Arab Emirates", "national", "middle", "9", "mathematics", "en");
    expect(packs[0]?.lessonTitle).toBe("Grade 9 Certificate: Algebra");
    expect(packs[0]?.canStart).toBe(true);
    expect(packs[1]?.lessonTitle).toBe("Grade 9 Certificate: Algebra");
    expect(packs[0]?.lessonTitles).toEqual(["Grade 9 Certificate: Algebra", "Certificate Revision Studio", "Grade 12 Certificate: Functions"]);
    expect(packs[0]?.lessonTitles).toHaveLength(3);
  });

  it("keeps planned challenge packs visible but not startable", () => {
    const packs = getRecommendedLessonPackages("saudi", "Saudi Arabia", "international", "sat", "SAT", "mathematics", "en");
    expect(packs[2]?.status).toBe("planned");
    expect(packs[2]?.lessonTitle).toBe("Algebra");
    expect(packs[2]?.canStart).toBe(false);
    expect(packs[2]?.lessonTitles).toEqual(["Algebra", "Advanced Math", "Data & problem-solving"]);
  });

  it("preserves linked lesson metadata in Arabic", () => {
    const packs = getRecommendedLessonPackages("qatar", "Qatar", "national", "secondary", "12", "mathematics", "ar");
    expect(packs[0]?.title).toContain("الرياضيات");
    expect(packs[0]?.lessonTitle).toBe("Grade 12 Certificate: Functions");
  });
});
