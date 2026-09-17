import { describe, expect, it } from "vitest";
import { getReferencesForBranch, lebaneseReferenceCatalog } from "../shared/lebaneseReferenceCatalog";

describe("uploaded Lebanese reference catalog", () => {
  it("separates certificate branches and companion solution guides", () => {
    expect(getReferencesForBranch("Life Sciences").map((item) => item.fileName)).toContain("grade12LS");
    expect(getReferencesForBranch("Sociology and Economics").map((item) => item.kind)).toContain("solution-guide");
    expect(getReferencesForBranch("General Sciences").every((item) => item.grade.includes("S3GS"))).toBe(true);
  });

  it("keeps uploaded source metadata explicit", () => {
    expect(lebaneseReferenceCatalog.length).toBeGreaterThanOrEqual(6);
    expect(lebaneseReferenceCatalog.every((item) => item.pages > 0)).toBe(true);
    expect(lebaneseReferenceCatalog.every((item) => item.topics.length > 0)).toBe(true);
  });
});
