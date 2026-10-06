// Region-locked pricing (approved by Munzer, 2026-10-06): the server decides the region from the
// geolocation claim + offline IP country + phone; mismatch → most expensive region + review flag;
// the browser can never pick the region or the price.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  mostExpensiveRegion,
  phoneRegionCandidates,
  regionFromCountry,
  regionSourceList,
  resolvePricingRegion,
  sanitizeRegionSignals,
} from "../src/lib/pricing/regionSignals.ts";
import { regionFromCoordinates } from "../src/lib/pricing/geoRegion.ts";
import { clientIpForGeo, clientIpHeaderName, countryForIp, ipCountryFromRequest } from "../src/lib/pricing/ipCountry.ts";
import { resolveRegionForRequest } from "../src/lib/pricing/regionServer.ts";
import { getRegionalPlan, getRegionalPricing } from "../src/lib/pricing/plans.ts";
import { liveCreditsForPlan } from "../src/lib/auth/tiers.ts";
import { createSubscribeOrder, resolvePlanAmount } from "../src/lib/billing/orders.ts";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { validatePaymentClaim } from "../src/lib/payments/validation.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const headers = (obj) => ({ get: (name) => obj[name.toLowerCase()] ?? null });
const RENDER = { RENDER: "true" };

test("coordinates → region on the device (Beirut, Riyadh, Dubai, New York, Paris, Toronto)", () => {
  assert.equal(regionFromCoordinates(33.8938, 35.5018), "lebanon");
  assert.equal(regionFromCoordinates(24.7136, 46.6753), "gcc");
  assert.equal(regionFromCoordinates(25.2048, 55.2708), "gcc");
  assert.equal(regionFromCoordinates(40.7128, -74.006), "admissions_us");
  assert.equal(regionFromCoordinates(48.8566, 2.3522), "international");
  assert.equal(regionFromCoordinates(43.6532, -79.3832), "international");
  assert.equal(regionFromCoordinates(Number.NaN, 0), null);
});

test("country and phone signals", () => {
  assert.equal(regionFromCountry("LB"), "lebanon");
  for (const cc of ["SA", "AE", "KW", "QA", "BH", "OM"]) assert.equal(regionFromCountry(cc), "gcc", cc);
  assert.equal(regionFromCountry("US"), "admissions_us");
  assert.equal(regionFromCountry("FR"), "international");
  assert.equal(regionFromCountry("XX"), null);
  assert.equal(regionFromCountry(null), null);
  assert.deepEqual(phoneRegionCandidates("+961 70 123 456"), ["lebanon"]);
  assert.deepEqual(phoneRegionCandidates("+966 50 123 4567"), ["gcc"]);
  assert.deepEqual(phoneRegionCandidates("+1 212 555 0100"), ["admissions_us", "international"]);
  assert.deepEqual(phoneRegionCandidates("+33 6 12 34 56 78"), ["international"]);
  assert.equal(phoneRegionCandidates("70123456"), null, "no country code → no signal");
});

test("region decision: no location → no prices; agreeing signals → that region, no flag", () => {
  const none = resolvePricingRegion({ ipCountry: "LB", phone: "+96170123456" });
  assert.equal(none.ok, false);
  assert.equal(none.reason, "location_required");

  const lb = resolvePricingRegion({ location: "lebanon", ipCountry: "LB", phone: "+96170123456" });
  assert.deepEqual(lb, { ok: true, region: "lebanon", mismatch: false, sources: { location: "lebanon", ip: "lebanon", phone: "lebanon" } });

  const onlyLocation = resolvePricingRegion({ location: "gcc" });
  assert.deepEqual(onlyLocation, { ok: true, region: "gcc", mismatch: false, sources: { location: "gcc" } });

  // +1 is shared by US / Canada: never a mismatch on its own.
  const toronto = resolvePricingRegion({ location: "international", ipCountry: "CA", phone: "+14165550100" });
  assert.equal(toronto.ok && toronto.region, "international");
  assert.equal(toronto.ok && toronto.mismatch, false);
  const nyc = resolvePricingRegion({ location: "admissions_us", ipCountry: "US", phone: "+12125550100" });
  assert.equal(nyc.ok && nyc.region, "admissions_us");
  assert.equal(nyc.ok && nyc.mismatch, false);
});

test("mismatch → the most expensive candidate region + review flag", () => {
  assert.equal(mostExpensiveRegion(["lebanon", "gcc"]), "gcc");
  assert.equal(mostExpensiveRegion(["lebanon", "gcc", "admissions_us"]), "admissions_us");
  assert.equal(mostExpensiveRegion(["admissions_us", "international"]), "international");

  const a = resolvePricingRegion({ location: "lebanon", ipCountry: "SA", phone: "+96170123456" });
  assert.deepEqual(a, { ok: true, region: "gcc", mismatch: true, sources: { location: "lebanon", ip: "gcc", phone: "lebanon" } });

  const b = resolvePricingRegion({ location: "lebanon", ipCountry: "LB", phone: "+447700900123" });
  assert.equal(b.ok && b.region, "international");
  assert.equal(b.ok && b.mismatch, true);

  const c = resolvePricingRegion({ location: "lebanon", ipCountry: "US" });
  assert.equal(c.ok && c.region, "admissions_us");
  assert.equal(c.ok && c.mismatch, true);
  assert.deepEqual(regionSourceList(c.sources), ["location", "ip"]);

  // The charge follows the decided region, from plans.ts.
  const charged = getRegionalPlan(a.region, "digitalCore").defaultChargeUSD;
  assert.equal(charged, 42);
  assert.ok(charged > getRegionalPlan("lebanon", "digitalCore").defaultChargeUSD);
});

test("only region names survive sanitising (never coordinates / IPs)", () => {
  assert.deepEqual(
    sanitizeRegionSignals({ location: "lebanon", ip: "1.2.3.4", phone: "gcc", lat: 33.9, lng: 35.5 }),
    { location: "lebanon", phone: "gcc" },
  );
  assert.deepEqual(sanitizeRegionSignals(null), {});
});

test("IP country: offline GeoIP database, trusted header only on Render (or when configured)", () => {
  assert.equal(countryForIp("94.187.0.1"), "LB", "Lebanese address");
  assert.equal(countryForIp("2.88.0.1"), "SA", "Saudi address");
  assert.equal(countryForIp("8.8.8.8"), "US");
  assert.equal(countryForIp("10.0.0.1"), null, "private address → no signal");
  assert.equal(countryForIp("not-an-ip"), null);

  assert.equal(clientIpHeaderName({}), null, "local dev: no trusted header");
  assert.equal(clientIpHeaderName(RENDER), "x-forwarded-for");
  assert.equal(clientIpHeaderName({ ...RENDER, MM_IP_GEO: "off" }), null);
  assert.equal(clientIpHeaderName({ MM_CLIENT_IP_HEADER: "CF-Connecting-IP" }), "cf-connecting-ip");

  const h = headers({ "x-forwarded-for": "94.187.0.1, 10.1.2.3", "cf-ipcountry": "US" });
  assert.equal(clientIpForGeo(h, {}), null, "a client-sent header is not trusted off Render");
  assert.equal(clientIpForGeo(h, RENDER), "94.187.0.1");
  assert.equal(ipCountryFromRequest(h, RENDER), "LB", "cf-ipcountry is ignored; the lookup decides");
  assert.equal(ipCountryFromRequest(headers({ "x-forwarded-for": "::ffff:2.88.0.1" }), RENDER), "SA");
  assert.equal(ipCountryFromRequest(headers({}), RENDER), null);
});

test("resolveRegionForRequest combines the location claim, the request IP and the phone", () => {
  const h = headers({ "x-forwarded-for": "2.88.0.1" });
  const r = resolveRegionForRequest({ location: "lebanon", headers: h, phone: "+96170123456", env: RENDER });
  assert.deepEqual(r, { ok: true, region: "gcc", mismatch: true, sources: { location: "lebanon", ip: "gcc", phone: "lebanon" } });
  const ok = resolveRegionForRequest({ location: "lebanon", headers: headers({ "x-forwarded-for": "94.187.0.1" }), phone: null, env: RENDER });
  assert.deepEqual(ok, { ok: true, region: "lebanon", mismatch: false, sources: { location: "lebanon", ip: "lebanon" } });
  assert.equal(resolveRegionForRequest({ location: "mars", headers: h, env: RENDER }).ok, false, "unknown location claim → prices stay hidden");
});

test("browser-sent region and price are ignored", async () => {
  // The claim's "region" is dropped by validation; only the location claim (one signal) survives.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date());
  const check = validatePaymentClaim({
    payerName: "Test Student", payerEmail: "s@example.com", plan: "digitalCore", period: "monthly", amount: "15", method: "whish",
    reference: "REF123456", transferDate: today, region: "lebanon", locationRegion: "lebanon",
  });
  assert.equal(check.ok, true, JSON.stringify(check));
  assert.equal("region" in check.value, false, "no client region on the validated claim");
  assert.equal(check.value.locationRegion, "lebanon");

  // A Lebanese location claim from a Saudi network is priced as GCC, whatever the browser said.
  const decided = resolveRegionForRequest({ location: check.value.locationRegion, headers: headers({ "x-forwarded-for": "2.88.0.1" }), env: RENDER });
  const priced = await resolvePlanAmount("digitalCore", "monthly", { region: decided.region });
  assert.equal(priced.ok, true);
  assert.equal(priced.amount, getRegionalPlan("gcc", "digitalCore").usdMonthly);
  assert.equal(priced.amount, 42);

  // Route handlers: no body region / price is read; the server resolver is always used.
  const subscribe = read("src/app/api/billing/subscribe-request/route.ts");
  assert.ok(!/body\.region\b|body\.(amount|price)\b/.test(subscribe), "subscribe-request ignores body region/amount");
  assert.ok(/resolveRegionForRequest\(/.test(subscribe));
  const payments = read("src/app/api/payments/route.ts");
  assert.ok(/resolveRegionForRequest\(/.test(payments));
  const service = read("src/lib/payments/service.ts");
  assert.ok(!/claim\.region\b/.test(service), "payment service never prices from claim.region");
  assert.ok(/resolvePlanAmount\(input\.claim\.plan, input\.claim\.period, \{ region: region\.region \}\)/.test(service));
  // No manual region picker left in the student-facing UI.
  for (const file of ["src/components/billing/SubscribePlans.tsx", "src/components/payments/PaymentClaimForm.tsx", "src/app/student/page.tsx"]) {
    const src = read(file);
    assert.ok(!/setRegion\(|PRICING_REGIONS\.map|pricingRegionFromCurriculum/.test(src), `${file}: no manual region choice`);
  }
  // Geolocation: coordinates are converted on the device and never sent.
  const hook = read("src/components/billing/useGeoRegion.ts");
  assert.ok(/JSON\.stringify\(\{ location: locationRegion \}\)/.test(hook));
  assert.ok(!/latitude[^)]*\bfetch|body:.*coords/.test(hook));
});

test("checkout order: mismatch → most expensive region charged + order flagged for review; no location → no order", async () => {
  const mem = new Map();
  setPersistentStoreOverride({
    getJSON: async (key) => (mem.has(key) ? structuredClone(mem.get(key)) : null),
    setJSON: async (key, value) => void mem.set(key, structuredClone(value)),
  });
  try {
    const base = { userId: "u-order", studentName: "Order Student", studentPhone: "+96170123456", planId: "digitalCore", period: "monthly" };
    // Lebanese location claim + Lebanese phone, but a Saudi network → GCC price, flagged.
    const region = resolveRegionForRequest({ location: "lebanon", headers: headers({ "x-forwarded-for": "2.88.0.1" }), phone: base.studentPhone, env: RENDER });
    // Extra body fields a tampered browser might send are not part of the input contract and change nothing.
    const flagged = await createSubscribeOrder({ ...base, region, amount: 1, price: 1, pricingRegion: "lebanon" });
    assert.equal(flagged.ok, true, JSON.stringify(flagged));
    assert.equal(flagged.order.pricingRegion, "gcc");
    assert.equal(flagged.order.amount, getRegionalPlan("gcc", "digitalCore").usdMonthly);
    assert.equal(flagged.order.regionMismatch, true, "order flagged for the owner's review");
    assert.deepEqual(flagged.order.regionSources, { location: "lebanon", ip: "gcc", phone: "lebanon" });

    const clean = await createSubscribeOrder({ ...base, region: resolvePricingRegion({ location: "lebanon", ipCountry: "LB", phone: base.studentPhone }) });
    assert.equal(clean.ok, true);
    assert.equal(clean.order.pricingRegion, "lebanon");
    assert.equal(clean.order.regionMismatch, false);
    assert.equal(clean.order.amount, getRegionalPlan("lebanon", "digitalCore").usdMonthly);

    const refused = await createSubscribeOrder({ ...base, region: resolvePricingRegion({ ipCountry: "LB", phone: base.studentPhone }) });
    assert.equal(refused.ok, false, "no geolocation claim → no prices, no order");
    const stored = [...mem.values()].find((v) => v && Array.isArray(v.orders));
    assert.equal(stored.orders.length, 2);
  } finally {
    setPersistentStoreOverride(null);
  }
});

test("'both' activation code = 4 live credits (was 8); GCC digital shown ≈ 157 SAR", () => {
  assert.equal(liveCreditsForPlan("both"), 4);
  assert.equal(liveCreditsForPlan("BOTH"), 4);
  assert.equal(liveCreditsForPlan("live"), 4);
  assert.equal(liveCreditsForPlan("liveHybrid"), 4);
  assert.equal(liveCreditsForPlan("ai"), 0);
  const gcc = getRegionalPlan("gcc", "digitalCore");
  assert.equal(gcc.sarMonthlyMin, 157);
  assert.equal(gcc.sarMonthlyMax, 157);
  assert.ok(getRegionalPricing("gcc").plans.every((plan) => plan.defaultChargeUSD > 0));
});

test("dashboard estimate has no '$5 per lesson' guess", () => {
  const dashboard = read("src/app/api/dashboard/route.ts");
  assert.ok(!/progress\.length\s*\*\s*5/.test(dashboard));
  assert.ok(/estimatedUsd: cardRevenueUsd,/.test(dashboard));
});
