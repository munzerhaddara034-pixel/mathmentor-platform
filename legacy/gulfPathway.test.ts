import { describe, expect, it } from "vitest";
import { getPathwayGuidance, getPathwayReadiness } from "../shared/gulfCurriculum";

describe("Gulf education pathway localization", () => {
  it("formats national and international pathways in English", () => {
    expect(getPathwayGuidance("national", "middle", "9", "en")).toContain("National / local-school pathway");
    expect(getPathwayGuidance("international", "secondary", "11", "en")).toContain("International pathway");
    expect(getPathwayGuidance("international", "sat", "SAT", "en")).toContain("SAT preparation");
  });

  it("formats pathway guidance in Arabic without mixing pathway labels", () => {
    expect(getPathwayGuidance("national", "middle", "9", "ar")).toContain("مسار وطني/مدرسي");
    expect(getPathwayGuidance("international", "secondary", "11", "ar")).toContain("مسار دولي");
  });

  it("keeps readiness guidance explicit about local review", () => {
    expect(getPathwayReadiness("national", "en")).toContain("ministry and school plan");
    expect(getPathwayReadiness("international", "ar")).toContain("لغة المدرسة");
  });
});
