// Static + shape guarantees for GET /api/admin/finance/summary (aggregates only, admin session).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

test("finance summary route: apiRequireAdmin first, aggregates only, no receipt / row dumps", () => {
  const source = read("src/app/api/admin/finance/summary/route.ts");
  const get = source.slice(source.indexOf("export async function GET"));
  const firstLines = get.split("\n").slice(1, 4).join("\n");
  assert.match(firstLines, /await apiRequireAdmin\(\)/);
  assert.match(source, /getFinanceSummary/);
  assert.match(source, /paymentsAvailable\(\)/);
  assert.ok(!/listPaymentsForAdmin|getReceipt|payer_name|payer_email|payer_phone/.test(source), "must not leak payment rows or payer PII");
  assert.ok(!/mm_payment_receipts|mm_documents|mm_audit_log/.test(source));
  assert.ok(!/\bbytes\b|sha256/.test(source), "must not touch receipt bytes");
});

test("getFinanceSummary SQL is aggregate-only (GROUP BY status / finance_status)", () => {
  const db = read("src/lib/payments/db.ts");
  const fn = db.slice(db.indexOf("export async function getFinanceSummary"), db.indexOf("export async function getFinanceSummary") + 2500);
  assert.match(fn, /FROM mm_payments[\s\S]*GROUP BY status/);
  assert.match(fn, /FROM mm_finance_subscriptions[\s\S]*GROUP BY finance_status/);
  assert.ok(!/SELECT[\s\S]*payer_name|SELECT[\s\S]*payer_email|SELECT[\s\S]*payer_phone|SELECT[\s\S]*reference/.test(fn));
  assert.ok(!/mm_payment_receipts/.test(fn));
  assert.match(fn, /lifetime_confirmed_usd/);
  assert.match(fn, /subscriber_count/);
  assert.match(fn, /currency: "USD"/);
});

test("finance summary uses the same admin session guard as /api/admin/payments (no new token)", () => {
  const payments = read("src/app/api/admin/payments/route.ts");
  const finance = read("src/app/api/admin/finance/summary/route.ts");
  assert.match(payments, /apiRequireAdmin/);
  assert.match(finance, /apiRequireAdmin/);
  assert.ok(!/mm_finance_ro|FINANCE_.*TOKEN|Bearer/.test(finance), "no finance RO API token invent");
});
