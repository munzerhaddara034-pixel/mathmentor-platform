import { describe, expect, it } from "vitest";
import { certificateScopes, getPriorityCertificateScopes } from "../shared/certificateScope";

describe("certificate curriculum scope", () => {
  it("prioritizes the Lebanese intermediate and secondary certificate tracks", () => {
    const launchScopes = getPriorityCertificateScopes("en");
    expect(launchScopes.map((scope) => scope.id)).toEqual([
      "lebanon-brevet",
      "lebanon-secondary-sciences",
      "lebanon-secondary-humanities",
    ]);
    expect(launchScopes[0]?.grades).toEqual(["9"]);
    expect(launchScopes[1]?.grades).toEqual(["10", "11", "12"]);
  });

  it("keeps Gulf middle and secondary scopes separate and review-gated", () => {
    const gulfScopes = certificateScopes.filter((scope) => scope.market === "gulf");
    expect(gulfScopes.map((scope) => scope.stage)).toEqual(["middle", "secondary"]);
    expect(gulfScopes.every((scope) => scope.priority === "next")).toBe(true);
    expect(gulfScopes.every((scope) => scope.reviewNote.length > 0)).toBe(true);
  });

  it("localizes priority labels without changing identifiers", () => {
    const arabic = getPriorityCertificateScopes("ar");
    expect(arabic[0]?.displayLabel).toContain("الشهادة المتوسطة");
    expect(arabic.map((scope) => scope.id)).toEqual(getPriorityCertificateScopes("en").map((scope) => scope.id));
  });
});
