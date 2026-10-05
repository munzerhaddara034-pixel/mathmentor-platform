// UI strings for the student AI tutor: Dr. Mohamed · Munzer's assistant, with a separate AI-tutor badge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/lib/i18n/messages/en.ts";
import { ar } from "../src/lib/i18n/messages/ar.ts";
import { fr } from "../src/lib/i18n/messages/fr.ts";
import { TUTOR_LABEL, TUTOR_NAME } from "../src/lib/tutor/persona.ts";

/** Staff WhatsApp secretary / ops phrasing — not the shared student-tutor name «محمد». */
const STAFF_ONLY = /سكرتير|executive secretary|WhatsApp agent|Agent Hub|code evolution/;

test("UI persona strings match the tutor persona; AI badge is separate from the Munzer's-assistant label", () => {
  for (const [locale, m] of Object.entries({ en, ar, fr })) {
    assert.equal(m.persona.name, TUTOR_NAME[locale], locale);
    assert.equal(m.persona.label, TUTOR_LABEL[locale], locale);
    assert.ok(m.persona.role, locale);
    assert.ok(m.persona.label.includes(m.persona.role), locale);
    // AI disclosure is the badge chip, not glued into the name·role label.
    assert.ok(m.persona.ai.length > 0, locale);
    assert.equal(m.assistant.name, m.persona.name, locale);
    for (const text of [m.assistant.greeting, m.solver.aiNote, m.result.reviewBody]) {
      assert.doesNotMatch(text, STAFF_ONLY, locale);
      assert.match(text, /AI|ذكاء|IA|assistant|مساعد|tuteur/i, locale);
    }
  }
  assert.match(en.persona.label, /Munzer's assistant/);
  assert.match(ar.persona.label, /مساعد منذر/);
  assert.match(fr.persona.label, /assistant de Munzer/);
  assert.equal(en.persona.ai, "AI tutor");
  assert.equal(ar.persona.ai, "معلّم بالذكاء الاصطناعي");
  assert.equal(fr.persona.ai, "Tuteur IA");
});
