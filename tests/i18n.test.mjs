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

test("brand spelling: «حداره» (with ha), never the ta-marbuta form", () => {
  const all = JSON.stringify([en, ar, fr]);
  assert.ok(!all.includes(WRONG_BRAND));
  assert.equal(ar.brand.name, "منذر حداره");
  assert.equal(en.persona.name, "Professor Munzer");
  assert.equal(fr.persona.name, "Professeur Munzer");
});

// ---------------------------------------------------------------------------------------------
// Feature catalogues (src/lib/i18n/ns/*.ts): every exported Record<Locale, …> must have the same
// deep key set (array lengths included) in en / ar / fr, non-empty strings, and the brand spelling.
// ---------------------------------------------------------------------------------------------
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const NS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/lib/i18n/ns");
const NS_FILES = readdirSync(NS_DIR).filter((name) => name.endsWith(".ts")).sort();
// Wrong brand spelling (ta marbuta), built from code points so the literal never appears in the repo.
const WRONG_BRAND = String.fromCharCode(0x062d, 0x062f, 0x0627, 0x0631, 0x0629);

function isLocaleRecord(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.keys(value).sort().join(",") === "ar,en,fr"
  );
}

function emptyLeaves(value, prefix = "") {
  if (typeof value === "string") return value.trim() === "" ? [prefix] : [];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => emptyLeaves(child, prefix ? `${prefix}.${key}` : key));
}

test("there are feature catalogues to check", () => {
  assert.ok(NS_FILES.length >= 10, `expected ≥10 ns files, found ${NS_FILES.length}`);
});

for (const file of NS_FILES) {
  test(`ns/${file}: ar and fr match the English keys (arrays included), no empty strings, brand spelling`, async () => {
    const mod = await import(pathToFileURL(path.join(NS_DIR, file)).href);
    const records = Object.entries(mod).filter(([, value]) => isLocaleRecord(value));
    assert.ok(records.length > 0, `${file} exports no Record<Locale, …>`);
    for (const [name, record] of records) {
      const reference = keys(record.en).sort();
      assert.deepEqual(keys(record.ar).sort(), reference, `${file} ${name}.ar keys differ from en`);
      assert.deepEqual(keys(record.fr).sort(), reference, `${file} ${name}.fr keys differ from en`);
      for (const locale of ["en", "ar", "fr"]) {
        assert.deepEqual(emptyLeaves(record[locale]), [], `${file} ${name}.${locale} has empty strings`);
      }
      assert.ok(!JSON.stringify(record).includes(WRONG_BRAND), `${file} ${name} uses the wrong brand spelling`);
    }
  });
}
