// Pricing v2 (approved by Munzer, 2026-10-06): one price source (src/lib/pricing/plans.ts),
// subscriber vs outside-student live sessions, liveHybrid = 4 × subscriber session, Gemini Flash preview cost.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  LIVE_HYBRID_SESSIONS,
  PLATFORM_FREE_FEATURE,
  PRICING_REGIONS,
  activationCodeValueUsd,
  getRegionalPlan,
  getRegionalPricing,
  outsideSessionUsd,
  pricingOptions,
  regionalPlanIdForLegacyPlan,
  subscriberSessionUsd,
} from "../src/lib/pricing/plans.ts";
import { costUsd } from "../src/lib/solver/gemini/pricing.ts";
import { defaultSettings } from "../src/lib/settings.ts";
import { runEmployeeCommand } from "../src/lib/commandEngine.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

// Approved table: digital / subscriber session / bundle / outside session.
const APPROVED = {
  lebanon: { digital: [15, 15, 15], session: 15, bundle: 60, outside: [25, 25, 25] },
  gcc: { digital: [42, 42, 42], session: 30, bundle: 120, outside: [50, 50, 50] },
  international: { digital: [60, 85, 72], session: 50, bundle: 200, outside: [70, 100, 85] },
  admissions_us: { digital: [45, 65, 55], session: 37, bundle: 148, outside: [50, 75, 62] },
};

test("plans.ts matches the approved v2 table for every region", () => {
  assert.deepEqual(PRICING_REGIONS.slice().sort(), Object.keys(APPROVED).sort());
  for (const [region, want] of Object.entries(APPROVED)) {
    const pack = getRegionalPricing(region);
    const digital = getRegionalPlan(region, "digitalCore");
    const hybrid = getRegionalPlan(region, "liveHybrid");
    assert.deepEqual([digital.usdMonthlyMin, digital.usdMonthlyMax, digital.defaultChargeUSD], want.digital, `${region} digital`);
    assert.equal(digital.usdMonthly, want.digital[2]);
    assert.equal(pack.subscriberSessionUsd, want.session, `${region} subscriber session`);
    assert.equal(subscriberSessionUsd(region), want.session);
    assert.deepEqual([hybrid.usdMonthlyMin, hybrid.usdMonthlyMax, hybrid.defaultChargeUSD, hybrid.usdMonthly], [want.bundle, want.bundle, want.bundle, want.bundle], `${region} bundle fixed`);
    assert.deepEqual([pack.privateTutoringHourMinUsd, pack.privateTutoringHourMaxUsd, pack.privateTutoringHourUsd], want.outside, `${region} outside session`);
    assert.equal(outsideSessionUsd(region), want.outside[2]);
  }
});

test("principle: bundle = 4 × subscriber session; subscribers pay less per session than outside students", () => {
  assert.equal(LIVE_HYBRID_SESSIONS, 4);
  for (const region of PRICING_REGIONS) {
    const pack = getRegionalPricing(region);
    const hybrid = getRegionalPlan(region, "liveHybrid");
    assert.equal(hybrid.defaultChargeUSD, LIVE_HYBRID_SESSIONS * pack.subscriberSessionUsd, region);
    assert.equal(hybrid.liveCredits, 4, region);
    assert.equal(hybrid.tier, "BOTH");
    assert.ok(pack.subscriberSessionUsd < pack.privateTutoringHourMinUsd, `${region}: subscriber < outside`);
    assert.equal(hybrid.usdTerm, Math.round(hybrid.usdMonthly * 2.5), `${region} term rule`);
  }
  assert.equal(getRegionalPlan("gcc", "liveHybrid").sarMonthlyMin, 450, "GCC bundle SAR hint = 120 × 3.75");
  assert.equal(getRegionalPlan("gcc", "liveHybrid").sarMonthlyMax, 450);
});

test("bundle shows 'Platform free with 4 sessions' (EN + AR) in every region", () => {
  assert.equal(PLATFORM_FREE_FEATURE.en, "Platform free with 4 sessions");
  assert.equal(PLATFORM_FREE_FEATURE.ar, "المنصة مجاناً مع 4 حصص");
  assert.ok(PLATFORM_FREE_FEATURE.fr.length > 0);
  for (const region of PRICING_REGIONS) {
    const hybrid = getRegionalPlan(region, "liveHybrid");
    assert.ok(hybrid.featuresEn.includes(PLATFORM_FREE_FEATURE.en), region);
    assert.ok(hybrid.featuresAr.includes(PLATFORM_FREE_FEATURE.ar), region);
    assert.ok(!getRegionalPlan(region, "digitalCore").featuresEn.includes(PLATFORM_FREE_FEATURE.en));
  }
});

test("pricingOptions: four options in order with display + charge", () => {
  assert.deepEqual(
    pricingOptions("lebanon").map((o) => [o.id, o.display, o.chargeUsd, o.unit, o.banded]),
    [
      ["subscription", "$15", 15, "month", false],
      ["subscriberSession", "$15", 15, "session", false],
      ["bundle", "$60", 60, "month", false],
      ["outsideSession", "$25", 25, "session", false],
    ],
  );
  assert.deepEqual(
    pricingOptions("international").map((o) => [o.id, o.display, o.chargeUsd, o.banded]),
    [
      ["subscription", "$60–85", 72, true],
      ["subscriberSession", "$50", 50, false],
      ["bundle", "$200", 200, false],
      ["outsideSession", "$70–100", 85, true],
    ],
  );
  assert.deepEqual(pricingOptions("gcc").map((o) => o.chargeUsd), [42, 30, 120, 50]);
  assert.deepEqual(pricingOptions("admissions_us").map((o) => o.chargeUsd), [55, 37, 148, 62]);
});

test("activation codes carry no price; their value comes from plans.ts", () => {
  for (const plan of defaultSettings.plans) {
    assert.ok(!("usdMonthly" in plan) && !("usdTerm" in plan), `settings plan ${plan.id} has no price`);
  }
  assert.equal(regionalPlanIdForLegacyPlan("ai"), "digitalCore");
  assert.equal(regionalPlanIdForLegacyPlan("sat"), "digitalCore");
  assert.equal(regionalPlanIdForLegacyPlan("both"), "liveHybrid");
  assert.equal(regionalPlanIdForLegacyPlan("live"), "liveHybrid");
  assert.equal(activationCodeValueUsd("g7-9"), 15);
  assert.equal(activationCodeValueUsd("both"), 60);
  assert.equal(activationCodeValueUsd("both", "gcc"), 120);
});

test("single price source: no hard-coded plan prices outside plans.ts", () => {
  const types = read("src/lib/types.ts");
  const sub = types.slice(types.indexOf("export type SubscriptionPlan"), types.indexOf("export type PlatformSettings"));
  assert.ok(!/usdMonthly|usdTerm/.test(sub), "SubscriptionPlan has no price fields");
  assert.ok(!/usdMonthly|usdTerm/.test(read("src/lib/settings.ts")));
  const store = read("src/lib/store.ts");
  assert.ok(!/\busd(Monthly|Term)\s*:|\.usd(Monthly|Term)\b/.test(store), "store never re-seeds legacy prices");

  const orders = read("src/lib/billing/orders.ts");
  assert.ok(!/settings\.plans|readStore/.test(orders), "orders.ts has no settings.ts price fallback");

  const student = read("src/app/student/page.tsx");
  assert.ok(!/usdMonthly|usdTerm|settings\.plans/.test(student));
  assert.match(student, /<PricingOptions/);

  const dashboard = read("src/app/api/dashboard/route.ts");
  assert.ok(!/\*\s*39\b/.test(dashboard), "activation-code value is not a hard-coded 39");
  assert.match(dashboard, /activationCodeValueUsd/);

  assert.ok(!/usdMonthly/.test(read("src/lib/commandEngine.ts")), "chat command cannot edit prices");
  assert.ok(!/\?\s*15\s*:\s*25|"25 USD"|"15 USD"/.test(read("src/components/live/LiveBookingBoard.tsx") + read("src/lib/whatsapp/notify.ts")));
  const whish = read("src/lib/whish/client.ts");
  assert.match(whish, /subscriberSessionUsd\(\)/);
  assert.match(whish, /outsideSessionUsd\(\)/);

  // Any numeric usdMonthly / usdTerm / defaultCharge literal must live in plans.ts.
  const offenders = walk(path.join(ROOT, "src"))
    .map((file) => path.relative(ROOT, file).split(path.sep).join("/"))
    .filter((file) => file !== "src/lib/pricing/plans.ts")
    .filter((file) => /\b(usdMonthly|usdTerm|defaultChargeUSD|subscriberSessionUsd)\s*:\s*\d/.test(read(file)));
  assert.deepEqual(offenders, []);
  // Old settings.ts price points never reappear as "$NN / month" copy in i18n.
  const exams = read("src/lib/i18n/ns/exams.ts");
  assert.ok(!/45\s?\$|\$45/.test(exams), "SAT copy reads its price from plans.ts");
});

test("checkout: regional plans priced from plans.ts; legacy ids and missing region are refused", async () => {
  const { resolvePlanAmount } = await import("../src/lib/billing/orders.ts");
  const leb = await resolvePlanAmount("liveHybrid", "monthly", { region: "lebanon" });
  assert.equal(leb.ok, true);
  assert.equal(leb.amount, 60);
  const us = await resolvePlanAmount("liveHybrid", "term", { region: "admissions_us" });
  assert.equal(us.amount, 370);
  const intl = await resolvePlanAmount("digitalCore", "monthly", { region: "international" });
  assert.equal(intl.amount, 72);
  for (const legacy of ["ai", "g7-9", "g11-12", "sat", "live", "both", "all"]) {
    const res = await resolvePlanAmount(legacy, "monthly");
    assert.equal(res.ok, false, legacy);
    assert.match(res.error, /no longer sold/);
    const withRegion = await resolvePlanAmount(legacy, "monthly", { region: "lebanon" });
    assert.equal(withRegion.ok, false, `${legacy} with region`);
  }
  const noRegion = await resolvePlanAmount("digitalCore", "monthly");
  assert.equal(noRegion.ok, false);
  assert.match(noRegion.error, /region/i);
});

test("live booking defaults come from plans.ts (Lebanon) unless env overrides", async () => {
  const saved = {};
  const keys = ["LIVE_SESSION_PRICE_USD", "NEXT_PUBLIC_LIVE_SESSION_PRICE_USD", "LIVE_SESSION_PRICE_EXTERNAL_USD", "NEXT_PUBLIC_LIVE_SESSION_PRICE_EXTERNAL_USD"];
  for (const key of keys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  try {
    const { memberSessionAmountUsd, externalSessionAmountUsd } = await import("../src/lib/whish/client.ts");
    assert.equal(memberSessionAmountUsd(), subscriberSessionUsd("lebanon"));
    assert.equal(externalSessionAmountUsd(), outsideSessionUsd("lebanon"));
    process.env.LIVE_SESSION_PRICE_USD = "18";
    assert.equal(memberSessionAmountUsd(), 18, "env override still works");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("chat command cannot change prices any more", () => {
  const result = runEmployeeCommand("غيّر سعر الاشتراك إلى 20 دولار", defaultSettings);
  assert.equal(result.settingsPatch, undefined);
  assert.match(result.reply, /plans\.ts/);
});

test("gemini-3-flash-preview costs $0.50 in / $3.00 out per 1M; other Flash models unchanged", () => {
  const M = 1_000_000;
  assert.equal(costUsd("gemini-3-flash-preview", { promptTokens: M, outputTokens: 0 }), 0.5);
  assert.equal(costUsd("gemini-3-flash-preview", { promptTokens: 0, outputTokens: M }), 3);
  assert.equal(costUsd("models/gemini-3-flash-preview", { promptTokens: M, outputTokens: M }), 3.5);
  assert.equal(costUsd("gemini-3.6-flash", { promptTokens: M, outputTokens: M }), 4.5, "3.6/3.7/3.8 Flash stay 0.75/3.75");
  assert.equal(costUsd("gemini-flash-latest", { promptTokens: M, outputTokens: M }), 4.5);
  assert.equal(costUsd("gemini-3.5-flash", { promptTokens: M, outputTokens: M }), 10.5);
  assert.equal(costUsd("gemini-pro-latest", { promptTokens: M, outputTokens: M }), 14);
});
