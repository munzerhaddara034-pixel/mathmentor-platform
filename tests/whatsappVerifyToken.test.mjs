// Meta webhook verify token: env only, fail closed, no hardcoded values anywhere; GET leaks nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const vt = await import("../src/lib/whatsapp/verifyToken.ts");
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const q = (o) => new URLSearchParams(o);

test("decideMetaVerification: unset ⇒ not_configured (fail closed); match ⇒ challenge; mismatch/bad", () => {
  const good = { "hub.mode": "subscribe", "hub.verify_token": "s3cret-value", "hub.challenge": "12345" };
  assert.deepEqual(vt.decideMetaVerification(q(good), {}), { ok: false, reason: "not_configured" });
  assert.deepEqual(vt.decideMetaVerification(q(good), { WHATSAPP_VERIFY_TOKEN: "   " }), { ok: false, reason: "not_configured" });
  assert.deepEqual(vt.decideMetaVerification(q(good), { WHATSAPP_VERIFY_TOKEN: " s3cret-value " }), { ok: true, challenge: "12345" });
  assert.deepEqual(
    vt.decideMetaVerification(q({ hub_mode: "subscribe", hub_verify_token: "s3cret-value", hub_challenge: "9" }), { WHATSAPP_VERIFY_TOKEN: "s3cret-value" }),
    { ok: true, challenge: "9" },
  );
  assert.deepEqual(vt.decideMetaVerification(q({ ...good, "hub.verify_token": "wrong" }), { WHATSAPP_VERIFY_TOKEN: "s3cret-value" }), { ok: false, reason: "mismatch" });
  for (const old of ["mathmentor_verify_token_2026", "mathmentor_secret_token"]) {
    assert.deepEqual(vt.decideMetaVerification(q({ ...good, "hub.verify_token": old }), {}), { ok: false, reason: "not_configured" }, old);
  }
  assert.deepEqual(vt.decideMetaVerification(q({ "hub.mode": "subscribe", "hub.verify_token": "s3cret-value" }), { WHATSAPP_VERIFY_TOKEN: "s3cret-value" }), { ok: false, reason: "bad_request" });
  assert.equal(vt.isVerificationAttempt(q(good)), true);
  assert.equal(vt.isVerificationAttempt(q({})), false);
});

test("unset token logs a clear line", () => {
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(String(line));
  try {
    vt.logVerificationFailure("/api/whatsapp", "not_configured");
  } finally {
    console.error = original;
  }
  assert.match(lines.join("\n"), /WHATSAPP_VERIFY_TOKEN is not set/);
});

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name === ".next" || name === ".git") return [];
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

test("no hardcoded verify tokens in src/, docs/, .env.example", () => {
  const targets = [...files("src"), ...files("docs"), ".env.example"];
  for (const file of targets) {
    const text = readFileSync(file, "utf8");
    assert.ok(!text.includes("mathmentor_verify_token_2026"), file);
    assert.ok(!text.includes("mathmentor_secret_token"), file);
  }
  for (const file of ["src/app/api/whatsapp/route.ts", "src/app/api/agent/whatsapp-voice/route.ts"]) {
    assert.match(read(file), /decideMetaVerification\(/, file);
    assert.ok(!/process\.env\.WHATSAPP_VERIFY_TOKEN/.test(read(file)), `${file} reads the token only via verifyToken.ts`);
  }
  assert.ok(!/VERIFY_TOKEN\s*=\s*"/.test(read("src/components/admin/agent/WhatsAppSetupAssistant.tsx")));
});

test("whatsapp-voice GET: no instructor / Whish phone numbers or allowlists", () => {
  const source = read("src/app/api/agent/whatsapp-voice/route.ts");
  const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  for (const leak of ["instructorWhatsAppNumber", "teacherWhatsApp", "allowlist:", "acceptedForms", "whishPaymentPhone", "76532421", "70772968"]) {
    assert.ok(!get.includes(leak), leak);
  }
  assert.match(get, /auth\.mode === "staff" \|\| auth\.mode === "secret"/, "details (no phones) for staff only");
});
