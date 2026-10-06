// Static guarantees for the payment flow: only the admin confirm route can activate, students can only
// create pending claims, every admin route is admin-only, teachers can no longer activate legacy orders.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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
const SRC_FILES = walk(path.join(ROOT, "src")).map((file) => path.relative(ROOT, file).split(path.sep).join("/"));

test("no auto-activation: the student submit route never touches activation code", () => {
  const route = read("src/app/api/payments/route.ts");
  for (const forbidden of ["confirmPayment", "confirmPaymentAsAdmin", "applyPaidEntitlement", "setUserEntitlement", "setUserSubscription", "mutateAuth"]) {
    assert.ok(!route.includes(forbidden), `student route must not reference ${forbidden}`);
  }
  const service = read("src/lib/payments/service.ts");
  const submit = service.slice(service.indexOf("export async function submitPaymentClaim"), service.indexOf("export async function confirmPaymentAsAdmin"));
  assert.ok(submit.length > 100);
  for (const forbidden of ["confirmPayment", "applyPaidEntitlement", "setUserEntitlement"]) {
    assert.ok(!submit.includes(forbidden), `submitPaymentClaim must not call ${forbidden}`);
  }
});

test("insertPayment can only ever insert status 'pending'", () => {
  const db = read("src/lib/payments/db.ts");
  const insert = db.slice(db.indexOf("export async function insertPayment"), db.indexOf("export async function getPayment"));
  assert.match(insert, /INSERT INTO mm_payments[\s\S]*VALUES \([^)]*'pending'[^)]*\)/);
  assert.ok(!/'confirmed'/.test(insert));
  assert.ok(!/mm_documents/.test(insert), "submitting never writes the auth document");
});

test("admin-only: confirmPaymentAsAdmin / rejectPaymentAsAdmin are called only from the admin routes", () => {
  const callers = (name) =>
    SRC_FILES.filter((file) => !file.startsWith("src/lib/payments/") && read(file).includes(name));
  assert.deepEqual(callers("confirmPaymentAsAdmin"), ["src/app/api/admin/payments/[id]/confirm/route.ts"]);
  assert.deepEqual(callers("rejectPaymentAsAdmin"), ["src/app/api/admin/payments/[id]/reject/route.ts"]);
  const directDb = SRC_FILES.filter((file) => {
    if (file === "src/lib/payments/service.ts" || file === "src/lib/payments/db.ts") return false;
    const source = read(file);
    return /from "@\/lib\/payments\/db"|from "\.\/db"/.test(source) && /\bconfirmPayment\b/.test(source);
  });
  assert.deepEqual(directDb, [], "nothing else imports the DB-level confirmPayment");
});

test("admin-only: every /api/admin/payments handler starts with apiRequireAdmin and mutations check origin", () => {
  const routes = SRC_FILES.filter((file) => file.startsWith("src/app/api/admin/payments/") && file.endsWith("route.ts"));
  assert.equal(routes.length, 4);
  for (const file of routes) {
    const source = read(file);
    const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b[\s\S]*?(?=\nexport |\n*$)/g)];
    assert.ok(handlers.length > 0, `${file} has handlers`);
    for (const [body, method] of handlers.map((m) => [m[0], m[1]])) {
      const first = body.split("\n").slice(1, 3).join("\n");
      assert.match(first, /await apiRequireAdmin\(\)/, `${file} ${method} must call apiRequireAdmin first`);
      if (method !== "GET") assert.match(body, /isSameOriginRequest\(request\.headers\)/, `${file} ${method} checks Origin`);
    }
  }
  const page = read("src/app/admin/payments/page.tsx");
  assert.match(page, /isVerifiedAdmin\(live\.user\)/);
  assert.match(page, /redirect\("\/admin"\)/);
});

test("apiRequireAdmin requires role admin (teachers excluded)", () => {
  const guards = read("src/lib/auth/guards.ts");
  const fn = guards.slice(guards.indexOf("export async function apiRequireAdmin"));
  assert.match(fn.slice(0, 600), /role !== "admin"/);
  const http = read("src/lib/payments/http.ts");
  assert.match(http, /user\.role === "admin" && user\.emailVerified/);
});

test("parents (and staff) cannot submit a payment claim", () => {
  const route = read("src/app/api/payments/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));
  assert.match(post.slice(0, 400), /if \(user\.role !== "student"\)/);
  assert.match(post.slice(0, 700), /status: 403/);
});

test("legacy /api/billing/confirm-payment: teacher_confirm is admin-only and audited", () => {
  const source = read("src/app/api/billing/confirm-payment/route.ts");
  assert.match(source, /const admin = isVerifiedAdmin\(user\);/);
  assert.match(source, /if \(!admin\) \{[\s\S]{0,200}status: 403/);
  const beforeConfirm = source.slice(0, source.indexOf("confirmSubscribePayment(order.id"));
  assert.ok(beforeConfirm.includes("if (!admin)"), "the admin check comes before activation");
  assert.match(source, /action: "billing\.order\.confirm"/);
  assert.ok(!source.includes("studentPhone || user.phone"), "never falls back to the confirming admin's phone");
});

test("notifications never use the 76532421 display fallback (contactPhone instead)", () => {
  const checks = [
    ["src/app/api/billing/subscribe-request/route.ts", "studentPhone: user.contactPhone"],
    ["src/app/api/redeem/route.ts", "live.user.contactPhone"],
    ["src/app/api/live/book/route.ts", "user?.contactPhone"],
    ["src/lib/whatsapp/notify.ts", "const phone = user?.contactPhone;"],
  ];
  for (const [file, needle] of checks) assert.ok(read(file).includes(needle), `${file} uses ${needle}`);
  assert.ok(!/user\??\.phone \|\| ""/.test(read("src/app/api/live/book/route.ts")));
  const notify = read("src/lib/payments/notify.ts");
  assert.ok(!/\.phone\b(?!\w)/.test(notify.replace(/payerPhone|contactPhone/g, "")), "payment notifications use payerPhone / contactPhone only");
});

test("receipt route: owner or verified admin only, nosniff + sandboxed", () => {
  const source = read("src/app/api/payments/[id]/receipt/route.ts");
  assert.match(source, /isVerifiedAdmin\(user\)/);
  assert.match(source, /nosniff/);
  assert.match(source, /sandbox/);
  assert.match(source, /no-store/);
});
