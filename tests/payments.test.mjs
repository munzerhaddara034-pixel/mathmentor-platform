// Manual payments (Whish / OMT, USD): pure validation, receipt sniffing, expiry maths, notification
// texts, settings precedence, migration text and the phone-fallback fix. No database needed.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  normalizeReference,
  transferDateProblem,
  validateConfirmBody,
  validatePaymentClaim,
  validateRejectNote,
} from "../src/lib/payments/validation.ts";
import { RECEIPT_MAX_BYTES, sniffImageMime, validateReceipt } from "../src/lib/payments/receipt.ts";
import { computePeriod, financeStatus, periodDaysFor } from "../src/lib/payments/expiry.ts";
import { escapeHtml, ownerAlertText, ownerEmail, paymentFlags, studentResultText } from "../src/lib/payments/messages.ts";
import {
  DEFAULT_BENEFICIARY_AR,
  DEFAULT_OWNER_EMAIL,
  DEFAULT_OWNER_WHATSAPP,
  DEFAULT_PAYMENT_NUMBER,
  ownerEmailAddress,
  ownerWhatsAppNumber,
  resolvePaymentSettings,
  sanitizeStoredSettings,
} from "../src/lib/payments/config.ts";
import { sendEmail } from "../src/lib/email/sender.ts";
import { SCHEMA_MIGRATIONS } from "../src/lib/db/schema.ts";
import { applyPaidEntitlementToAuthDoc, asPublicUser } from "../src/lib/auth/store.ts";

const NOW = new Date("2026-10-04T09:00:00Z"); // 12:00 Beirut
const DAY = 24 * 60 * 60 * 1000;

const claim = (over = {}) => ({
  payerName: "Rami Saad",
  payerEmail: "Rami@Example.com",
  payerPhone: "03 123 456",
  plan: "ai_monthly",
  period: "monthly",
  region: "lebanon",
  amount: "25",
  currency: "USD",
  method: "whish",
  reference: " ab 12-34/x ",
  transferDate: "2026-10-03",
  ...over,
});

// ---------------------------------------------------------------- validation
test("valid claim is normalised (reference upper-case, phone +961, e-mail lower-case, USD)", () => {
  const result = validatePaymentClaim(claim(), NOW);
  assert.equal(result.ok, true);
  assert.equal(result.value.reference, "AB12-34/X");
  assert.equal(result.value.referenceRaw, "ab 12-34/x");
  assert.equal(result.value.payerPhone, "+9613123456");
  assert.equal(result.value.payerEmail, "rami@example.com");
  assert.equal(result.value.currency, "USD");
  assert.equal(result.value.amount, 25);
});

test("currency is USD only (LBP rejected) and unknown fields are rejected (strict)", () => {
  assert.equal(validatePaymentClaim(claim({ currency: "LBP" }), NOW).ok, false);
  const extra = validatePaymentClaim(claim({ status: "confirmed" }), NOW);
  assert.equal(extra.ok, false, "a client cannot smuggle status=confirmed");
  assert.equal(validatePaymentClaim(claim({ aiExpiresAt: "2030-01-01" }), NOW).ok, false);
});

test("claim requires e-mail or phone, valid method, positive 2-decimal amount", () => {
  assert.equal(validatePaymentClaim(claim({ payerEmail: "", payerPhone: "" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ payerEmail: "" }), NOW).ok, true);
  assert.equal(validatePaymentClaim(claim({ method: "western_union" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ amount: "0" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ amount: "-5" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ amount: "10.555" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ amount: "10.55" }), NOW).ok, true);
  assert.equal(validatePaymentClaim(claim({ payerPhone: "12" }), NOW).ok, false);
});

test("reference normalisation and pattern", () => {
  assert.equal(normalizeReference("  omt 99 88 "), "OMT9988");
  assert.equal(validatePaymentClaim(claim({ reference: "ab" }), NOW).ok, false, "too short");
  assert.equal(validatePaymentClaim(claim({ reference: "<script>" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ reference: "-abc" }), NOW).ok, false);
  assert.equal(validatePaymentClaim(claim({ reference: "x".repeat(65) }), NOW).ok, false);
});

test("phone normalisation", () => {
  assert.equal(normalizePhone("76532421"), "+96176532421");
  assert.equal(normalizePhone("03123456"), "+9613123456");
  assert.equal(normalizePhone("+961 70 772 968"), "+96170772968");
  assert.equal(normalizePhone("0096170772968"), "+96170772968");
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("123"), null);
});

test("transfer date window: Beirut today -60 .. +1 days", () => {
  assert.equal(transferDateProblem("2026-10-04", NOW), null);
  assert.equal(transferDateProblem("2026-10-05", NOW), null);
  assert.equal(transferDateProblem("2026-10-06", NOW), "future");
  assert.equal(transferDateProblem("2026-08-05", NOW), null);
  assert.equal(transferDateProblem("2026-08-04", NOW), "too_old");
  assert.equal(transferDateProblem("2026-02-30", NOW), "invalid");
  assert.equal(transferDateProblem("04/10/2026", NOW), "invalid");
});

test("reject note is required; confirm override must be future and <= 400 days", () => {
  assert.equal(validateRejectNote("").ok, false);
  assert.equal(validateRejectNote("   ").ok, false);
  assert.equal(validateRejectNote(undefined).ok, false);
  assert.equal(validateRejectNote("x".repeat(1001)).ok, false);
  assert.deepEqual(validateRejectNote("  not in Whish  "), { ok: true, note: "not in Whish" });

  assert.deepEqual(validateConfirmBody({}, NOW), { ok: true, expiresAt: null, note: null });
  assert.equal(validateConfirmBody({ expiresAt: "2026-10-01" }, NOW).ok, false, "past");
  assert.equal(validateConfirmBody({ expiresAt: "2028-01-01" }, NOW).ok, false, "too far");
  assert.equal(validateConfirmBody({ expiresAt: "garbage" }, NOW).ok, false);
  const ok = validateConfirmBody({ expiresAt: "2026-11-30", note: " ok " }, NOW);
  assert.equal(ok.ok, true);
  assert.equal(ok.note, "ok");
  assert.ok(ok.expiresAt instanceof Date);
});

// ---------------------------------------------------------------- receipt upload validation
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Uint8Array.from([...Buffer.from("RIFF"), 0x24, 0, 0, 0, ...Buffer.from("WEBPVP8 ")]);

test("upload validation accepts JPEG, PNG and WebP by magic bytes (with sha256)", () => {
  for (const [bytes, mime] of [
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [WEBP, "image/webp"],
  ]) {
    assert.equal(sniffImageMime(bytes), mime);
    const check = validateReceipt(bytes);
    assert.equal(check.ok, true);
    assert.equal(check.mimeType, mime);
    assert.match(check.sha256, /^[0-9a-f]{64}$/);
  }
});

test("upload validation rejects SVG, HTML renamed .jpg, PDF, GIF, empty and > 5 MB", () => {
  const reject = (bytes, reason) => {
    const check = validateReceipt(bytes);
    assert.equal(check.ok, false);
    assert.equal(check.reason, reason);
  };
  reject(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "unsupported");
  reject(Buffer.from("<!doctype html><html><script>alert(1)</script>"), "unsupported");
  reject(Buffer.from("%PDF-1.7\n%âãÏÓ"), "unsupported");
  reject(Buffer.from("GIF89a\x01\x00\x01\x00"), "unsupported");
  reject(Buffer.from("RIFF\x24\x00\x00\x00WAVEfmt "), "unsupported");
  reject(new Uint8Array(0), "empty");
  const big = new Uint8Array(RECEIPT_MAX_BYTES + 1);
  big.set(JPEG);
  reject(big, "too_big");
  const exact = new Uint8Array(RECEIPT_MAX_BYTES);
  exact.set(JPEG);
  assert.equal(validateReceipt(exact).ok, true, "exactly 5 MB is allowed");
});

// ---------------------------------------------------------------- expiry
test("expiry: 30 days monthly, 90 days term, extended from an active expiry", () => {
  assert.equal(periodDaysFor("monthly"), 30);
  assert.equal(periodDaysFor("term"), 90);
  const fresh = computePeriod(null, "monthly", NOW);
  assert.equal(fresh.start.getTime(), NOW.getTime());
  assert.equal(fresh.end.getTime(), NOW.getTime() + 30 * DAY);
  const expired = computePeriod(new Date(NOW.getTime() - 5 * DAY), "term", NOW);
  assert.equal(expired.end.getTime(), NOW.getTime() + 90 * DAY, "expired → from now");
  const active = new Date(NOW.getTime() + 10 * DAY);
  const extended = computePeriod(active.toISOString(), "monthly", NOW);
  assert.equal(extended.start.getTime(), active.getTime());
  assert.equal(extended.end.getTime(), active.getTime() + 30 * DAY, "active → extended from current expiry");
  const override = new Date(NOW.getTime() + 45 * DAY);
  assert.equal(computePeriod(active, "monthly", NOW, override).end.getTime(), override.getTime());
});

test("finance status buckets", () => {
  assert.equal(financeStatus(null, NOW), "never_paid");
  assert.equal(financeStatus(new Date(NOW.getTime() - 1), NOW), "overdue");
  assert.equal(financeStatus(new Date(NOW.getTime() + 3 * DAY), NOW), "expiring_soon");
  assert.equal(financeStatus(new Date(NOW.getTime() + 8 * DAY), NOW), "active");
});

// ---------------------------------------------------------------- notifications
const payment = (over = {}) => ({
  id: "pay_1",
  userId: "u1",
  payerName: 'Rami <img src=x onerror="alert(1)">',
  payerEmail: "rami@example.com",
  payerPhone: "+9613123456",
  plan: "ai_monthly",
  period: "monthly",
  pricingRegion: "lebanon",
  expectedAmountUsd: 25,
  amount: 20,
  currency: "USD",
  method: "omt",
  reference: "AB12",
  referenceRaw: "ab12",
  transferDate: "2026-10-03",
  receiptUrl: "/api/payments/pay_1/receipt",
  orderId: null,
  status: "pending",
  submittedAt: NOW.toISOString(),
  reviewedAt: null,
  reviewedBy: null,
  note: null,
  periodStart: null,
  periodEnd: null,
  ownerNotifiedAt: null,
  studentNotifiedAt: null,
  ...over,
});

test("owner e-mail escapes student input and flags amount mismatch; alert says nothing is activated", () => {
  const p = payment();
  assert.deepEqual(paymentFlags(p), ["AMOUNT MISMATCH"]);
  const mail = ownerEmail(p, "https://example.test/admin/payments?id=pay_1");
  assert.ok(!mail.html.includes("<img"), "HTML is escaped");
  assert.ok(mail.html.includes("&lt;img"));
  assert.ok(mail.text.includes("NOT activated"));
  assert.ok(!mail.subject.includes("\n"));
  const alert = ownerAlertText(p, "https://example.test/admin/payments");
  assert.ok(alert.body.includes("Nothing is activated until you press Confirm."));
  assert.ok(alert.body.includes("OMT"));
  assert.equal(escapeHtml(`"'<>&`), "&quot;&#39;&lt;&gt;&amp;");
  const rejected = studentResultText(payment({ status: "rejected", note: "not found" }));
  assert.ok(rejected.body.includes("not found"));
});

test("e-mail sender forwards receipt attachments to Resend (fake fetch) and logs only file names", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ id: "em_1" }) };
  };
  const attachments = [{ filename: "receipt-pay_1.jpg", content: Buffer.from(JPEG).toString("base64") }];
  const sent = await sendEmail(
    { to: DEFAULT_OWNER_EMAIL, subject: "s", text: "t", attachments },
    { env: { RESEND_API_KEY: "test-key", NODE_ENV: "production" }, fetchImpl },
  );
  assert.equal(sent.ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body.attachments, attachments);
  assert.deepEqual(calls[0].body.to, [DEFAULT_OWNER_EMAIL]);
  const lines = [];
  await sendEmail({ to: "x@example.com", subject: "s", text: "t", attachments }, { env: { NODE_ENV: "test" }, log: (l) => lines.push(l) });
  assert.ok(lines[0].includes("attachments=receipt-pay_1.jpg"));
  assert.ok(!lines[0].includes(attachments[0].content), "base64 bytes are never logged");
});

// ---------------------------------------------------------------- settings
test("payment settings: defaults 70772968 / منذر أحمد حداره, env overrides, admin settings win", () => {
  const defaults = resolvePaymentSettings(null, {});
  assert.equal(DEFAULT_PAYMENT_NUMBER, "70772968");
  assert.equal(defaults.whish.number, "70772968");
  assert.equal(defaults.omt.number, "70772968");
  assert.equal(defaults.whish.nameAr, DEFAULT_BENEFICIARY_AR);
  assert.equal(DEFAULT_BENEFICIARY_AR, "منذر أحمد حداره");
  assert.equal(defaults.whish.enabled, true);
  assert.equal(defaults.omt.enabled, true);

  const env = { PAYMENTS_WHISH_NUMBER: "71000000", PAYMENTS_OMT_ENABLED: "false" };
  const fromEnv = resolvePaymentSettings(null, env);
  assert.equal(fromEnv.whish.number, "71000000");
  assert.equal(fromEnv.omt.number, "70772968");
  assert.equal(fromEnv.omt.enabled, false);

  const stored = { whish: { number: "79111111" }, omt: { enabled: true, number: "" } };
  const fromAdmin = resolvePaymentSettings(stored, env);
  assert.equal(fromAdmin.whish.number, "79111111", "admin setting beats env");
  assert.equal(fromAdmin.omt.enabled, true);
  assert.equal(fromAdmin.omt.number, "70772968", "blank admin value falls back");

  assert.equal(ownerWhatsAppNumber({}), "96176532421");
  assert.equal(DEFAULT_OWNER_WHATSAPP, "96176532421");
  assert.equal(ownerEmailAddress({}), "munzerhaddara2@gmail.com");
  assert.equal(ownerEmailAddress({ PAYMENTS_OWNER_EMAIL: "x@example.com" }), "x@example.com");

  assert.deepEqual(sanitizeStoredSettings({ whish: { number: "70 77 29 68", enabled: false, evil: 1 } }), {
    whish: { number: "70772968", enabled: false },
  });
  assert.throws(() => sanitizeStoredSettings({ omt: { number: "12" } }));
});

// ---------------------------------------------------------------- migrations
test("payments migration: partial unique index on active rows, USD only, scoped grants", () => {
  const ids = SCHEMA_MIGRATIONS.map((m) => m.id);
  assert.ok(ids.indexOf("007_payments") > ids.indexOf("006_profile_locale"));
  assert.ok(ids.indexOf("008_finance_views") > ids.indexOf("007_payments"));
  const sql007 = SCHEMA_MIGRATIONS.find((m) => m.id === "007_payments").sql;
  assert.match(sql007, /CREATE UNIQUE INDEX IF NOT EXISTS mm_payments_method_reference_active\s+ON mm_payments \(method, reference\) WHERE status IN \('pending', 'confirmed'\)/);
  assert.match(sql007, /CHECK \(currency = 'USD'\)/);
  assert.ok(!/LBP/.test(sql007));
  assert.ok(!/\bDROP\b|\bTRUNCATE\b|\bDELETE\b/i.test(sql007.replace(/ON DELETE CASCADE/g, "")), "no destructive DDL");
  for (const migration of SCHEMA_MIGRATIONS.filter((m) => ["007_payments", "008_finance_views"].includes(m.id))) {
    assert.ok(!/CREATE TABLE (?!IF NOT EXISTS)/.test(migration.sql), `${migration.id} must be re-runnable`);
    assert.ok(!/CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/.test(migration.sql), `${migration.id} must be re-runnable`);
  }
  const sql008 = SCHEMA_MIGRATIONS.find((m) => m.id === "008_finance_views").sql;
  assert.ok(!/ALL TABLES/i.test(sql008), "never GRANT ON ALL TABLES");
  assert.ok(!/CREATE ROLE|PASSWORD/i.test(sql008), "the role is created manually, never by a migration");
  assert.match(sql008, /GRANT SELECT ON mm_payments, mm_finance_subscriptions TO mm_finance_ro/);
  assert.ok(!/mm_payment_receipts|mm_documents TO/.test(sql008.split("GRANT")[1] ?? ""), "no grant on receipts or documents");
});

// ---------------------------------------------------------------- phone fallback / entitlement
test("contactPhone is the real phone (null when missing); display phone keeps the watermark fallback", () => {
  const base = { id: "u1", email: "a@example.com", name: "A", role: "student", passwordHash: "x", createdAt: NOW.toISOString() };
  const noPhone = asPublicUser({ ...base });
  assert.equal(noPhone.contactPhone, null, "no phone → no WhatsApp target");
  assert.equal(noPhone.phone, "76532421", "watermark display fallback unchanged");
  assert.equal(asPublicUser({ ...base, phone: " 03123456 " }).contactPhone, "03123456");
});

test("applyPaidEntitlementToAuthDoc sets the computed expiry once and leaves other users alone", () => {
  const doc = {
    users: [
      { id: "u1", email: "a@example.com", name: "A", role: "student", passwordHash: "x", createdAt: NOW.toISOString() },
      { id: "u2", email: "b@example.com", name: "B", role: "student", passwordHash: "x", createdAt: NOW.toISOString(), aiExpiresAt: null },
    ],
    sessions: [],
    revokedTokens: [],
  };
  const end = new Date(NOW.getTime() + 30 * DAY);
  const applied = applyPaidEntitlementToAuthDoc(doc, "u1", "ai_monthly", end);
  assert.equal(applied.user.id, "u1");
  const u1 = applied.doc.users.find((u) => u.id === "u1");
  const u2 = applied.doc.users.find((u) => u.id === "u2");
  assert.equal(u1.aiExpiresAt, end.toISOString());
  assert.equal(u2.aiExpiresAt ?? null, null);
  assert.equal(applyPaidEntitlementToAuthDoc(doc, "missing", "ai_monthly", end).user, undefined);
});
