import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const docs = new Map();
const backend = {
  async getJSON(key) {
    return docs.has(key) ? structuredClone(docs.get(key)) : null;
  },
  async setJSON(key, value) {
    docs.set(key, structuredClone(value));
  },
};

const dataDir = await import("../src/lib/dataDir.ts");
const actions = await import("../src/lib/team/youssefActions.ts");
dataDir.setPersistentStoreOverride(backend);

after(() => dataDir.setPersistentStoreOverride(null));
beforeEach(() => docs.clear());

describe("Youssef design artifacts", () => {
  test("creates a self-contained HTML artifact for the requested section", async () => {
    const artifact = await actions.createYoussefDesign("يوسف، صمّم صفحة الأسعار");
    assert.ok(artifact.html.length > 0);
    assert.match(artifact.html, /<!doctype html>/i);
    assert.match(artifact.html, /<style>/i);
    assert.match(artifact.html, /dir="rtl"/i);
    assert.match(artifact.html, /صفحة الأسعار/);
    assert.ok(!artifact.html.includes("https://"));
    assert.ok(artifact.brief.palette.length > 0);
    assert.ok(artifact.brief.typographyScale.length > 0);
    assert.ok(artifact.brief.spacing.length > 0);
  });

  test("persists both the HTML and design brief through the shared store", async () => {
    const created = await actions.createYoussefDesign("صمّم قسم الباقات");
    const saved = await actions.listYoussefDesigns();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].id, created.id);
    assert.equal(saved[0].html, created.html);
    assert.deepEqual(saved[0].brief, created.brief);
  });

  test("the design page requires the same staff gate as the admin area", async () => {
    const source = await readFile(new URL("../src/app/admin/designs/page.tsx", import.meta.url), "utf8");
    assert.match(source, /requireStaff\("\/admin\/designs"\)/);
    assert.match(source, /srcDoc=\{design\.html\}/);
    assert.match(source, /sandbox=""/);
  });
});
