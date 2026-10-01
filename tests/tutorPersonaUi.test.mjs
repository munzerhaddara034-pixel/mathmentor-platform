// UI strings for the student AI tutor persona carry the visible AI label in en/ar/fr.
import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/lib/i18n/messages/en.ts";
import { ar } from "../src/lib/i18n/messages/ar.ts";
import { fr } from "../src/lib/i18n/messages/fr.ts";
import { TUTOR_LABEL, TUTOR_NAME } from "../src/lib/tutor/persona.ts";

const STAFF_AGENT = /Mohamed|Mohammad|Muhammad|محمد|دكتور الرياضيات|Dr\.\s*M/;

test("UI persona strings match the tutor persona and carry the AI label", () => {
  for (const [locale, m] of Object.entries({ en, ar, fr })) {
    assert.equal(m.persona.name, TUTOR_NAME[locale], locale);
    assert.equal(m.persona.label, TUTOR_LABEL[locale], locale);
    assert.ok(m.persona.label.toLowerCase().includes(m.persona.ai.toLowerCase()), locale);
    assert.equal(m.assistant.name, m.persona.name, locale);
    for (const text of [m.assistant.greeting, m.solver.aiNote, m.result.reviewBody]) assert.doesNotMatch(text, STAFF_AGENT, locale);
  }
});
