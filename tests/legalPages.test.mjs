// Legal pages (privacy, terms): every locale must carry the full document, the pages must stay
// publicly reachable and indexable, and both must appear in sitemap.xml while staying out of the
// robots disallow list. Guards against a page being dropped or a locale silently falling behind.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PRIVACY, TERMS, LEGAL_CONTACT, LEGAL_TITLES } from "../src/lib/legal/content.ts";
import { PUBLIC_PATHS, isPrivatePath } from "../src/lib/auth/paths.ts";
import sitemap from "../src/app/sitemap.ts";
import robots from "../src/app/robots.ts";

const LOCALES = ["ar", "en", "fr"];
/** Sections a payment provider or a data-protection request would look for. */
const REQUIRED = {
  privacy: ["collect", "sharing", "retention", "children", "rights", "contact"],
  terms: ["subscription", "refund", "ip", "ai", "live", "law", "contact"],
};

describe("legal pages", () => {
  for (const [id, docs] of [
    ["privacy", PRIVACY],
    ["terms", TERMS],
  ]) {
    for (const locale of LOCALES) {
      test(`${id} (${locale}) is complete`, () => {
        const doc = docs[locale];
        assert.ok(doc, `${id}.${locale} exists`);
        assert.ok(doc.title.trim().length > 3, "title");
        assert.ok(doc.lead.trim().length > 40, "lead");
        assert.ok(doc.updated.trim().length > 4, "update date");
        assert.ok(doc.sections.length >= 10, "enough sections");
        for (const section of doc.sections) {
          assert.ok(section.heading.trim().length > 3, `heading of ${section.id}`);
          const content = [...(section.body ?? []), ...(section.bullets ?? [])];
          assert.ok(content.length > 0, `${section.id} has content`);
          // Short bullets are legitimate ("Correct any inaccurate data."); the section as a whole must be real.
          for (const line of content) assert.ok(line.trim().length > 20, `${section.id} line is substantive`);
          assert.ok(content.join(" ").length > 80, `${section.id} says enough`);
        }
        const ids = doc.sections.map((section) => section.id);
        assert.equal(new Set(ids).size, ids.length, "section ids are unique");
        for (const required of REQUIRED[id]) assert.ok(ids.includes(required), `${id} covers ${required}`);
      });
    }
  }

  test("both pages are public, indexable and absent from the robots disallow list", () => {
    for (const path of ["/privacy", "/terms"]) {
      assert.ok(PUBLIC_PATHS.includes(path), `${path} is public`);
      assert.equal(isPrivatePath(path), false, `${path} is not private`);
    }
    const rules = robots().rules;
    const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((rule) => rule.disallow ?? []);
    for (const path of ["/privacy", "/terms"]) {
      assert.ok(!disallow.some((entry) => String(entry).startsWith(path)), `${path} is crawlable`);
    }
  });

  test("sitemap.xml lists both pages", () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.some((url) => url.endsWith("/privacy")), "privacy in sitemap");
    assert.ok(urls.some((url) => url.endsWith("/terms")), "terms in sitemap");
  });

  test("contact channels are real, not placeholders", () => {
    assert.match(LEGAL_CONTACT.email, /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
    assert.match(LEGAL_CONTACT.whatsapp, /^\d{8,15}$/);
    assert.ok(!/example|todo|placeholder|change/i.test(LEGAL_CONTACT.email), "no placeholder address");
    for (const locale of LOCALES) {
      assert.ok(LEGAL_TITLES.privacy[locale].length > 3);
      assert.ok(LEGAL_TITLES.terms[locale].length > 3);
    }
  });
});
