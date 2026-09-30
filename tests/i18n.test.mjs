import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LOCALE, dirFor, resolveLocale } from "../src/lib/i18n/config.ts";
import { en } from "../src/lib/i18n/messages/en.ts";
import { ar } from "../src/lib/i18n/messages/ar.ts";
import { fr } from "../src/lib/i18n/messages/fr.ts";

test("English is the default with no (or an unknown) locale cookie", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(resolveLocale(undefined), "en");
  assert.equal(resolveLocale(""), "en");
  assert.equal(resolveLocale("ar-LB,ar;q=0.9"), "en"); // an Accept-Language value is never used
  assert.equal(resolveLocale("de"), "en");
  assert.equal(resolveLocale("ar"), "ar");
  assert.equal(resolveLocale("fr"), "fr");
});

test("only Arabic is right-to-left", () => {
  assert.equal(dirFor("en"), "ltr");
  assert.equal(dirFor("fr"), "ltr");
  assert.equal(dirFor("ar"), "rtl");
});

function keys(value, prefix = "") {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

test("ar and fr catalogues have exactly the English keys", () => {
  const reference = keys(en).sort();
  assert.deepEqual(keys(ar).sort(), reference);
  assert.deepEqual(keys(fr).sort(), reference);
});

test("brand spelling: «حداره», never «حدارة»", () => {
  const all = JSON.stringify([en, ar, fr]);
  assert.ok(!all.includes("حدارة"));
  assert.equal(ar.brand.name, "منذر حداره");
  assert.equal(en.persona.name, "Professor Munzer");
  assert.equal(fr.persona.name, "Professeur Munzer");
});
