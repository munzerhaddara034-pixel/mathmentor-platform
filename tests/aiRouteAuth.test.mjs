// /api/bot and the WhatsApp-voice Gemini proxy spend Gemini quota: AI-access users, staff or the agent secret only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("aiCaller gate: secret/staff via agent auth (never demo), else session + AI access; 401 sign-in, 403 upgrade, 429", () => {
  const source = read("src/lib/security/aiCaller.ts");
  assert.match(source, /agent\.mode === "secret" \|\| agent\.mode === "staff"/);
  assert.ok(!/mode === "demo"/.test(source), "demo mode never authorises Gemini spend");
  assert.match(source, /await userHasAiAccess\(user\)/);
  assert.match(source, /isStaffRole\(user\.role\)/);
  assert.match(source, /needSignIn: true[\s\S]*status: 401/);
  assert.match(source, /needAi: true[\s\S]*status: 403/);
  assert.match(source, /status: 429/);
});

test("/api/bot: gate runs before the body is read; message and audio are capped", () => {
  const source = read("src/app/api/bot/route.ts");
  const post = source.slice(source.indexOf("export async function POST"));
  assert.match(post, /^export async function POST\(request: Request\) \{\n(?:\s*\/\/.*\n)*\s*const caller = await authorizeAiCaller\(request\);\n\s*if \(!caller\.ok\) return caller\.response;/);
  assert.ok(post.indexOf("authorizeAiCaller") < post.indexOf("request.formData"));
  assert.ok(post.indexOf("authorizeAiCaller") < post.indexOf("request.json"));
  assert.match(source, /MAX_MESSAGE_CHARS/);
  assert.match(source, /MAX_AUDIO_BYTES/);
});

test("WhatsApp-voice Gemini proxy: gated, size-capped, GET 405 without config, no provider error echo", () => {
  const source = read("src/app/api/agent/whatsapp-voice/gemini/route.ts");
  const post = source.slice(source.indexOf("export async function POST"));
  assert.match(post, /^export async function POST\(req: NextRequest\) \{\n\s*const caller = await authorizeAiCaller\(req\);\n\s*if \(!caller\.ok\) return caller\.response;/);
  const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  assert.match(get, /status: 405/);
  assert.ok(!/GEMINI|process\.env|geminiConfigured/.test(get));
  assert.ok(!source.includes("تعذر تفريغ الصوت: ${detail}"), "no raw error message to the caller");
  assert.match(source, /MAX_AUDIO_BYTES/);
  assert.ok(!source.includes("باسم الأستاذ منذر حداره"), "no human-teacher persona");
});

test("solve-math/gemini GET: geminiConfigured only for staff", () => {
  const source = read("src/app/api/solve-math/gemini/route.ts");
  const get = source.slice(source.indexOf("export async function GET"));
  assert.match(get, /const guard = await apiRequireStaff\(\);[\s\S]*if \(!guard\.error\) body\.geminiConfigured/);
});

test("ChatWidget: 401 shows a clear sign-in prompt + link; 403 upgrade link; strings in en/ar/fr", async () => {
  const widget = read("src/components/ChatWidget.tsx");
  assert.match(widget, /response\.status === 401[\s\S]*a\.signInPrompt[\s\S]*\/login\?next=/);
  assert.match(widget, /response\.status === 403 && data\.needAi[\s\S]*a\.upgradePrompt/);
  assert.match(widget, /row\.link \?/);
  const { en } = await import("../src/lib/i18n/messages/en.ts");
  const { ar } = await import("../src/lib/i18n/messages/ar.ts");
  const { fr } = await import("../src/lib/i18n/messages/fr.ts");
  for (const m of [en, ar, fr]) {
    for (const key of ["signInPrompt", "signInCta", "upgradePrompt", "upgradeCta", "rateLimited"]) {
      assert.ok(typeof m.assistant[key] === "string" && m.assistant[key].length > 3, key);
    }
    assert.ok(m.assistant.signInPrompt.includes(m.assistant.name));
  }
});
