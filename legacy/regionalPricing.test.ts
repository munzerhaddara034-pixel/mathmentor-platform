import { describe, expect, it } from "vitest";
import { getRegionalPlans, regionalPricingPlans } from "./regionalPricing";

describe("regional launch pricing", () => {
  it("keeps Lebanon and Gulf plans separated", () => {
    expect(getRegionalPlans("lebanon").every((plan) => plan.market === "lebanon")).toBe(true);
    expect(getRegionalPlans("gulf").every((plan) => plan.market === "gulf")).toBe(true);
    expect(getRegionalPlans("lebanon").length).toBeGreaterThan(0);
    expect(getRegionalPlans("gulf").length).toBeGreaterThan(0);
  });

  it("marks every launch amount as a proposal requiring approval", () => {
    expect(regionalPricingPlans.every((plan) => plan.status === "proposed")).toBe(true);
    expect(regionalPricingPlans.every((plan) => plan.priceUsd > 0)).toBe(true);
  });

  it("keeps manual payment language for Lebanon", () => {
    expect(getRegionalPlans("lebanon").every((plan) => plan.paymentNote.toLowerCase().includes("whish"))).toBe(true);
  });
});
