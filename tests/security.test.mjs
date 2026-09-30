// Security hardening: rate limiting, e-mail verification helpers, pluggable sender, audit entries,
// security headers, Meta webhook signatures, /api/content redaction, guest-cookie shape, audit migration.
// Run: npm test   (Node >= 22.18 strips TypeScript types natively.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { authRateLimits, clientIpFrom, createRateLimiter, tooManyRequestsBody } from "../src/lib/security/rateLimit.ts";
import {
  checkVerificationToken,
  EMAIL_VERIFICATION_RESEND_GAP_MS,
  EMAIL_VERIFICATION_TTL_MS,
  hashVerificationToken,
  isEmailVerified,
  isPlausibleVerificationToken,
  newVerificationToken,
  shouldResendVerification,
  verificationEmail,
  verificationLink,
} from "../src/lib/auth/emailVerification.ts";
import { emailProvider, sendEmail } from "../src/lib/email/sender.ts";
import { buildAuditEntry } from "../src/lib/security/auditEntry.ts";
import { CSP_REPORT_ONLY, securityHeaders } from "../src/lib/security/headers.ts";
import { safeEqual, verifyMetaSignature } from "../src/lib/security/webhookSignature.ts";
import { redactStoreForViewer } from "../src/lib/security/contentRedaction.ts";
import { looksLikeGuestToken } from "../src/lib/livekit/guestCookie.ts";
import { signJoinToken } from "../src/lib/livekit/joinToken.ts";
import { SCHEMA_MIGRATIONS } from "../src/lib/db/schema.ts";

const headers = (map) => ({ get: (name) => map[name.toLowerCase()] ?? null });

test("rate limiter blocks after max hits within the window and recovers after it", () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 3 });
  const t0 = 1_000_000;
  assert.equal(limiter.hit("a", t0).ok, true);
  assert.equal(limiter.hit("a", t0 + 1).ok, true);
  assert.equal(limiter.hit("a", t0 + 2).ok, true);
  const blocked = limiter.hit("a", t0 + 3);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1);
  assert.equal(limiter.hit("b", t0 + 3).ok, true, "keys are independent");
  assert.equal(limiter.check("a", t0 + 999).ok, false);
  assert.equal(limiter.hit("a", t0 + 1001).ok, true, "new window");
  limiter.reset("a");
  assert.equal(limiter.check("a", t0 + 1002).ok, true);
});

test("rate limiter caps memory under a flood of distinct keys", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, maxKeys: 100 });
  for (let i = 0; i < 1000; i += 1) limiter.hit(`k${i}`, 5);
  assert.ok(limiter.size() <= 100);
});

test("auth limiters: login failures per email lock after 10, signup per IP after 10", () => {
  const key = `login:test-${Date.now()}@example.com`;
  for (let i = 0; i < 10; i += 1) authRateLimits.loginEmailFailures.hit(key);
  assert.equal(authRateLimits.loginEmailFailures.check(key).ok, false);
  authRateLimits.loginEmailFailures.reset(key);
  assert.equal(authRateLimits.loginEmailFailures.check(key).ok, true);
  const ip = `203.0.113.${Math.floor(Math.random() * 200)}`;
  let last;
  for (let i = 0; i < 11; i += 1) last = authRateLimits.signupIp.hit(`${ip}-signup-test`);
  assert.equal(last.ok, false);
  const body = tooManyRequestsBody(125);
  assert.match(body.errorAr, /3 دقيقة/);
});

test("clientIpFrom uses the first X-Forwarded-For entry, then X-Real-IP", () => {
  assert.equal(clientIpFrom(headers({ "x-forwarded-for": "198.51.100.7, 10.0.0.1" })), "198.51.100.7");
  assert.equal(clientIpFrom(headers({ "x-real-ip": "198.51.100.8" })), "198.51.100.8");
  assert.equal(clientIpFrom(headers({})), "unknown");
});

test("existing accounts are grandfathered as verified; new signups are pending until verified", () => {
  assert.equal(isEmailVerified({}), true, "legacy account without the field");
  assert.equal(isEmailVerified({ emailVerifiedAt: undefined }), true);
  assert.equal(isEmailVerified({ emailVerifiedAt: null }), false, "new signup");
  assert.equal(isEmailVerified({ emailVerifiedAt: "" }), false);
  assert.equal(isEmailVerified({ emailVerifiedAt: "2026-09-30T18:00:00.000Z" }), true);
  assert.equal(isEmailVerified(null), false);
  // Survives a JSON round-trip (store persistence): undefined drops, null stays.
  const persisted = JSON.parse(JSON.stringify({ legacy: { a: 1, emailVerifiedAt: undefined }, fresh: { emailVerifiedAt: null } }));
  assert.equal(isEmailVerified(persisted.legacy), true);
  assert.equal(isEmailVerified(persisted.fresh), false);
});

test("verification tokens: random, hashed at rest, expire after 24h, reject mismatches", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const a = newVerificationToken(now);
  const b = newVerificationToken(now);
  assert.notEqual(a.token, b.token);
  assert.ok(isPlausibleVerificationToken(a.token));
  assert.equal(a.state.tokenHash, hashVerificationToken(a.token));
  assert.ok(!JSON.stringify(a.state).includes(a.token), "raw token is never stored");
  assert.deepEqual(checkVerificationToken(a.state, a.token, now + 1000), { ok: true });
  assert.deepEqual(checkVerificationToken(a.state, b.token, now + 1000), { ok: false, reason: "mismatch" });
  assert.deepEqual(checkVerificationToken(a.state, a.token, now + EMAIL_VERIFICATION_TTL_MS + 1), { ok: false, reason: "expired" });
  assert.deepEqual(checkVerificationToken(null, a.token, now), { ok: false, reason: "missing" });
  assert.equal(isPlausibleVerificationToken("../../etc/passwd"), false);
  assert.equal(isPlausibleVerificationToken(""), false);
});

test("resend gap: no new e-mail within 5 minutes of the last one", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  const { state } = newVerificationToken(now);
  assert.equal(shouldResendVerification(state, now + 1000), false);
  assert.equal(shouldResendVerification(state, now + EMAIL_VERIFICATION_RESEND_GAP_MS), true);
  assert.equal(shouldResendVerification(null, now), true);
});

test("verification link points at /login?verify= on the configured origin", () => {
  assert.equal(
    verificationLink("tok_1", "http://localhost:3000", { APP_BASE_URL: "https://mathmentor.example/" }),
    "https://mathmentor.example/login?verify=tok_1",
  );
  assert.equal(verificationLink("tok_2", "https://req.example", {}), "https://req.example/login?verify=tok_2");
  assert.equal(verificationLink("t", "https://req.example", { APP_BASE_URL: "javascript:alert(1)" }), "https://req.example/login?verify=t");
  const mail = verificationEmail({ name: "<b>Munzer</b>", link: "https://x.example/login?verify=abc" });
  assert.ok(mail.text.includes("https://x.example/login?verify=abc"));
  assert.ok(!mail.html.includes("<b>Munzer"), "name is escaped/stripped in HTML");
});

test("e-mail sender: Resend when RESEND_API_KEY is set, dev log otherwise, none in production", async () => {
  assert.equal(emailProvider({ RESEND_API_KEY: "k", NODE_ENV: "production" }), "resend");
  assert.equal(emailProvider({ NODE_ENV: "development" }), "log");
  assert.equal(emailProvider({ NODE_ENV: "production" }), "none");
  assert.equal(emailProvider({ NODE_ENV: "production", EMAIL_DEV_LOG_LINKS: "1" }), "log");

  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
  };
  const sent = await sendEmail(
    { to: "a@example.com", subject: "s", text: "t" },
    { env: { RESEND_API_KEY: "test-key", EMAIL_FROM: "MM <no-reply@example.com>", NODE_ENV: "production" }, fetchImpl },
  );
  assert.deepEqual(sent, { ok: true, provider: "resend", id: "email_123" });
  assert.equal(captured.url, "https://api.resend.com/emails");
  assert.equal(captured.init.headers.Authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(captured.init.body).to, ["a@example.com"]);

  const failing = await sendEmail(
    { to: "a@example.com", subject: "s", text: "t" },
    { env: { RESEND_API_KEY: "k" }, fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: "domain not verified" }) }) },
  );
  assert.equal(failing.ok, false);
  assert.match(failing.error, /403/);

  const lines = [];
  const logged = await sendEmail({ to: "b@example.com", subject: "s", text: "link" }, { env: { NODE_ENV: "test" }, log: (l) => lines.push(l) });
  assert.equal(logged.provider, "log");
  assert.match(lines[0], /b@example.com/);

  const none = await sendEmail({ to: "c@example.com", subject: "s", text: "t" }, { env: { NODE_ENV: "production" } });
  assert.deepEqual({ ok: none.ok, provider: none.provider }, { ok: false, provider: "none" });
});

test("audit entries redact secret-looking keys and cap size", () => {
  const entry = buildAuditEntry({
    action: "live_slot.delete",
    actor: { id: "user_1", email: "admin@example.com", role: "admin" },
    target: "live-slot:slot_9",
    ip: "198.51.100.7",
    details: { slot: { id: "slot_9" }, password: "hunter2", nested: { apiKey: "x", accessToken: "y" } },
    now: new Date("2026-09-30T18:00:00Z"),
  });
  assert.equal(entry.at, "2026-09-30T18:00:00.000Z");
  assert.equal(entry.actorEmail, "admin@example.com");
  assert.equal(entry.details.password, "[redacted]");
  assert.equal(entry.details.nested.apiKey, "[redacted]");
  assert.equal(entry.details.nested.accessToken, "[redacted]");
  assert.deepEqual(entry.details.slot, { id: "slot_9" });
  const huge = buildAuditEntry({ action: "x", details: { blob: Array.from({ length: 50 }, () => "z".repeat(500)) } });
  assert.deepEqual(huge.details, { truncated: true });
});

test("audit migration is additive only and makes the table append-only", () => {
  const migration = SCHEMA_MIGRATIONS.find((m) => m.id === "005_audit_log");
  assert.ok(migration);
  assert.match(migration.sql, /CREATE TABLE IF NOT EXISTS mm_audit_log/);
  assert.match(migration.sql, /BEFORE UPDATE OR DELETE ON mm_audit_log/);
  for (const m of SCHEMA_MIGRATIONS) {
    assert.doesNotMatch(m.sql, /\bDROP\s+(TABLE|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\b[^;]*\bDROP\b/i, m.id);
  }
});

test("security headers: clickjacking enforced, CSP report-only, nosniff, referrer, HSTS", () => {
  const map = Object.fromEntries(securityHeaders().map((h) => [h.key, h.value]));
  assert.equal(map["X-Frame-Options"], "SAMEORIGIN");
  assert.equal(map["Content-Security-Policy"], "frame-ancestors 'self'");
  assert.equal(map["Content-Security-Policy-Report-Only"], CSP_REPORT_ONLY);
  assert.match(CSP_REPORT_ONLY, /object-src 'none'/);
  assert.equal(map["X-Content-Type-Options"], "nosniff");
  assert.equal(map["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(map["Strict-Transport-Security"], /max-age=31536000/);
  assert.match(map["Permissions-Policy"], /microphone=\(self\)/);
});

test("Meta webhook signature: accepts the real HMAC, rejects forgeries", () => {
  const secret = "app-secret-for-tests";
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
  const good = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(verifyMetaSignature(raw, good, secret), true);
  assert.equal(verifyMetaSignature(raw, good.toUpperCase().replace("SHA256=", "sha256="), secret), true);
  assert.equal(verifyMetaSignature(raw + " ", good, secret), false);
  assert.equal(verifyMetaSignature(raw, "sha256=deadbeef", secret), false);
  assert.equal(verifyMetaSignature(raw, null, secret), false);
  assert.equal(verifyMetaSignature(raw, good, ""), false);
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
});

test("/api/content redaction: students never see scratch codes, entitlements or staff chat", () => {
  const store = {
    library: [{ id: "lib1", title: "Book", sourcePath: "/srv/books/secret.pdf" }],
    drafts: [{ id: "d1" }],
    managerMessages: [{ id: "m1", text: "internal" }],
    outreach: [{ id: "o1" }],
    settings: { phone: "1" },
    studentChat: [],
    progress: [{ lessonId: "l1" }],
    customLessons: [{ id: "c1" }],
    scratchCards: [{ code: "MM-SECRET-CODE", planId: "ai", used: false }],
    quizAttempts: [{ id: "q" }],
    customQuestions: [],
    entitlements: [{ id: "e1", studentName: "X", phone: "70000000" }],
    exams: [],
  };
  const student = redactStoreForViewer(store, { staff: false });
  assert.deepEqual(student.scratchCards, []);
  assert.deepEqual(student.entitlements, []);
  assert.deepEqual(student.managerMessages, []);
  assert.deepEqual(student.outreach, []);
  assert.ok(!JSON.stringify(student).includes("MM-SECRET-CODE"));
  assert.ok(!JSON.stringify(student).includes("/srv/books"));
  assert.deepEqual(student.progress, store.progress);
  assert.deepEqual(student.customLessons, store.customLessons);
  assert.equal(student.library[0].title, "Book");
  assert.equal(redactStoreForViewer(store, { staff: true }), store);
});

test("middleware guest-cookie shape check: real join tokens pass, junk does not", () => {
  const token = signJoinToken({ bookingId: "bk_1", studentId: "st_1", expiresAt: Date.now() + 60_000 }, "x".repeat(32));
  assert.equal(looksLikeGuestToken(token), true);
  assert.equal(looksLikeGuestToken("1"), false);
  assert.equal(looksLikeGuestToken("anything"), false);
  assert.equal(looksLikeGuestToken(""), false);
  assert.equal(looksLikeGuestToken(undefined), false);
  assert.equal(looksLikeGuestToken(`${"a".repeat(600)}.${"b".repeat(600)}`), false);
});
