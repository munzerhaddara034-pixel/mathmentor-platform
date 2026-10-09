import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setPersistentStoreOverride } from "../src/lib/dataDir.ts";
import { loadTeamMemory, medianDuration, readTeamHealth, recordTeamHealth, saveTeamMemory } from "../src/lib/team/health.ts";

const routeSource = readFileSync(new URL("../src/app/api/admin/team/health/route.ts", import.meta.url), "utf8");

test("team health persistence is bounded, redacted, and aggregates median duration", async () => {
  const values = new Map();
  setPersistentStoreOverride({
    async getJSON(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async setJSON(key, value) { values.set(key, structuredClone(value)); },
  });
  try {
    await saveTeamMemory({ agent: "mohamed", intent: "student secret sk-live-1234567890123456", summary: "a".repeat(2_000), tools: Array.from({ length: 20 }, () => "read_file"), outcome: "success", verified: true, notes: "n".repeat(5_000) });
    await recordTeamHealth({ agent: "mohamed", intent: "request", tools: ["read_file"], outcome: "success", durationMs: 100, verified: true, escalation: false });
    await recordTeamHealth({ agent: "mohamed", intent: "request", tools: ["team_memory"], outcome: "failed", durationMs: 300, verified: false, escalation: true, failure: "failed" });
    const memory = await loadTeamMemory("mohamed");
    const snapshot = await readTeamHealth();
    assert.equal(memory.notes.length, 3_000);
    assert.equal(memory.summaries[0].summary.length, 500);
    assert.equal(memory.summaries[0].tools.length, 1);
    assert.equal(memory.summaries[0].intent.includes("sk-live"), false);
    assert.equal(snapshot.records.length, 2);
    assert.equal(medianDuration(snapshot.records), 200);
  } finally {
    setPersistentStoreOverride(null);
  }
});

test("team health API is staff-gated, read-only, bounded, and no-store", () => {
  assert.match(routeSource, /requireTeamStaff\(\)/);
  assert.match(routeSource, /readTeamHealth\(\)/);
  assert.match(routeSource, /medianDuration\(records\)/);
  assert.match(routeSource, /Cache-Control.*no-store/);
  assert.doesNotMatch(routeSource, /return NextResponse\.json\(\{ ok: true, records/);
});
