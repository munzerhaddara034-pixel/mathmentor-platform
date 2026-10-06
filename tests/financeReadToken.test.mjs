// GET /api/finance/summary — Bearer MM_FINANCE_READ_TOKEN (constant-time), aggregates only.
// Exercises the pure handler with a mocked summary; tests/paymentsPg.test.mjs covers the real DB path.
// The token used here is random per run (never a real value).
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  FINANCE_READ_RATE,
  FINANCE_READ_TOKEN_ENV,
  bearerTokenFrom,
  configuredFinanceReadToken,
  financeTokenMatches,
  handleFinanceSummaryRequest,
} from "../src/lib/finance/readToken.ts";
import { createRateLimiter } from "../src/lib/security/rateLimit.ts";
import { isPrivatePath } from "../src/lib/auth/paths.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

const TOKEN = `test-${randomBytes(24).toString("hex")}`;
const SUMMARY = {
  currency: "USD",
  mm_payments: {
    pending: { count: 1, sum_amount: 25 },
    confirmed: { count: 3, sum_amount: 120 },
    rejected: { count: 0, sum_amount: 0 },
  },
  mm_finance_subscriptions: { never_paid: 4, overdue: 1, expiring_soon: 0, active: 2 },
  totals: { lifetime_confirmed_usd: 120, subscriber_count: 2 },
};

let ipSeq = 0;
const req = ({ method = "GET", auth, ip } = {}) => {
  const headers = new Headers({ "x-forwarded-for": ip ?? `10.0.0.${++ipSeq}` });
  if (auth !== undefined) headers.set("authorization", auth);
  return new Request("https://mathmentor.test/api/finance/summary", { method, headers });
};
const deps = (over = {}) => ({
  env: { [FINANCE_READ_TOKEN_ENV]: TOKEN },
  databaseAvailable: () => true,
  loadSummary: async () => SUMMARY,
  limiter: createRateLimiter(FINANCE_READ_RATE),
  ...over,
});

test("env unset / empty / whitespace → 503 (fails closed) even with a Bearer header", async () => {
  for (const env of [{}, { [FINANCE_READ_TOKEN_ENV]: "" }, { [FINANCE_READ_TOKEN_ENV]: "   " }]) {
    const res = await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps({ env }));
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok(!JSON.stringify(await res.json()).includes(TOKEN));
  }
  assert.equal(configuredFinanceReadToken({}), null);
});

test("missing Authorization → 401", async () => {
  const res = await handleFinanceSummaryRequest(req(), deps());
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("www-authenticate") ?? "", /^Bearer/);
});

test("wrong token / wrong scheme / prefix / suffix → 401", async () => {
  for (const auth of [
    "Bearer nope",
    `Bearer ${TOKEN}x`,
    `Bearer ${TOKEN.slice(0, -1)}`,
    `Basic ${TOKEN}`,
    TOKEN,
    "Bearer ",
    `Bearer ${TOKEN} extra`,
    `Bearer ${"a".repeat(5000)}`,
  ]) {
    const res = await handleFinanceSummaryRequest(req({ auth }), deps());
    assert.equal(res.status, 401, auth.slice(0, 40));
  }
});

test("correct token → 200 with exactly the getFinanceSummary payload, no-store", async () => {
  const res = await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const body = await res.json();
  assert.deepEqual(body, { ok: true, ...SUMMARY });
  // scheme is case-insensitive
  const lower = await handleFinanceSummaryRequest(req({ auth: `bearer ${TOKEN}` }), deps());
  assert.equal(lower.status, 200);
});

test("database not configured → 503 (after auth); summary failure → 500 without detail", async () => {
  const noDb = await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps({ databaseAvailable: () => false }));
  assert.equal(noDb.status, 503);
  const logs = [];
  const failing = await handleFinanceSummaryRequest(
    req({ auth: `Bearer ${TOKEN}` }),
    deps({ loadSummary: async () => { throw new Error("connection refused"); }, logError: (m) => logs.push(m) }),
  );
  assert.equal(failing.status, 500);
  assert.deepEqual(await failing.json(), { ok: false, error: "Finance summary failed." });
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes(TOKEN));
});

test("POST / PUT / PATCH / DELETE → 405 with Allow: GET", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const res = await handleFinanceSummaryRequest(req({ method, auth: `Bearer ${TOKEN}` }), deps());
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get("allow"), "GET");
  }
});

test("rate limit: 30 requests/min per IP, then 429 with Retry-After (counts before the token check)", async () => {
  const limiter = createRateLimiter(FINANCE_READ_RATE);
  const now = 1_000_000;
  for (let i = 0; i < FINANCE_READ_RATE.max; i += 1) {
    const res = await handleFinanceSummaryRequest(req({ ip: "203.0.113.9", auth: i % 2 ? "Bearer wrong" : `Bearer ${TOKEN}` }), deps({ limiter, now }));
    assert.notEqual(res.status, 429, `request ${i + 1}`);
  }
  const blocked = await handleFinanceSummaryRequest(req({ ip: "203.0.113.9", auth: `Bearer ${TOKEN}` }), deps({ limiter, now }));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  const otherIp = await handleFinanceSummaryRequest(req({ ip: "203.0.113.10", auth: `Bearer ${TOKEN}` }), deps({ limiter, now }));
  assert.equal(otherIp.status, 200, "other IPs are unaffected");
  const later = await handleFinanceSummaryRequest(req({ ip: "203.0.113.9", auth: `Bearer ${TOKEN}` }), deps({ limiter, now: now + 61_000 }));
  assert.equal(later.status, 200, "window resets");
});

test("token and Authorization header never reach console output", async () => {
  const captured = [];
  const originals = {};
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    originals[name] = console[name];
    console[name] = (...args) => captured.push(args.map(String).join(" "));
  }
  try {
    await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps());
    await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}zz` }), deps());
    await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps({ env: {} }));
    await handleFinanceSummaryRequest(req({ auth: `Bearer ${TOKEN}` }), deps({ loadSummary: async () => { throw new Error("boom"); } }));
  } finally {
    Object.assign(console, originals);
  }
  const all = captured.join("\n");
  assert.ok(!all.includes(TOKEN), "token never logged");
  assert.ok(!/authorization|bearer/i.test(all), "Authorization header never logged");
});

test("helpers: bearer parsing and constant-time digest comparison", () => {
  assert.equal(bearerTokenFrom(new Headers({ authorization: `Bearer ${TOKEN}` })), TOKEN);
  assert.equal(bearerTokenFrom(new Headers()), null);
  assert.equal(financeTokenMatches(TOKEN, TOKEN), true);
  assert.equal(financeTokenMatches("short", TOKEN), false, "different lengths do not throw");
  assert.equal(financeTokenMatches(null, TOKEN), false);
  const lib = read("src/lib/finance/readToken.ts");
  assert.match(lib, /timingSafeEqual\(digest\(given\), digest\(expected\)\)/);
  assert.match(lib, /createHash\("sha256"\)/);
  assert.ok(!/console\.\w+\([^)]*(authorization|expected|given|token)/i.test(lib), "no console call with token material");
});

test("route wiring: separate from the admin route, GET only, no session guard, middleware lets it through", () => {
  const route = read("src/app/api/finance/summary/route.ts");
  assert.match(route, /handleFinanceSummaryRequest/);
  assert.match(route, /getFinanceSummary/);
  assert.match(route, /export async function POST\(\)[\s\S]*financeMethodNotAllowed/);
  assert.ok(!/apiRequireAdmin|apiSession|console\./.test(route));
  assert.ok(!/payer_|getReceipt|listPaymentsForAdmin|mm_payment_receipts/.test(route));
  const admin = read("src/app/api/admin/finance/summary/route.ts");
  assert.ok(!/Bearer|MM_FINANCE_READ_TOKEN|readToken/.test(admin), "admin route keeps session-only auth");
  assert.equal(isPrivatePath("/api/finance/summary"), false, "middleware does not redirect bearer callers to /login");
});

test("no real token value committed: docs name the env var only, .env.example has no value", () => {
  const docs = read("docs/PAYMENTS.md");
  assert.match(docs, /MM_FINANCE_READ_TOKEN/);
  assert.ok(!/MM_FINANCE_READ_TOKEN\s*=\s*\S/.test(docs));
  const example = read(".env.example");
  assert.ok(!/MM_FINANCE_READ_TOKEN\s*=\s*\S/.test(example));
});
