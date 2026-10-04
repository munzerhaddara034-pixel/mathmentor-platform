// /api/health: ok / version / db up|down|disabled — nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { healthReport, buildVersion } = await import("../src/lib/health.ts");
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const now = new Date("2026-10-05T00:00:00Z");

test("db disabled / up / down / timeout; no error text", async () => {
  assert.deepEqual(await healthReport({ dbEnabled: false, probe: async () => 1, env: {}, now }), { ok: true, service: "mathmentor", version: null, db: "disabled", time: now.toISOString() });
  const up = await healthReport({ dbEnabled: true, probe: async () => 1, env: { RENDER_GIT_COMMIT: "FA23099CAA4ED03BCA3A5C520EB99EC4EF4CC6CE" }, now });
  assert.equal(up.db, "up");
  assert.equal(up.ok, true);
  assert.equal(up.version, "fa23099");
  const down = await healthReport({ dbEnabled: true, probe: async () => { throw new Error("password authentication failed for user neondb_owner at ep-x.neon.tech"); }, env: {}, now });
  assert.deepEqual(Object.keys(down).sort(), ["db", "ok", "service", "time", "version"]);
  assert.equal(down.db, "down");
  assert.equal(down.ok, false);
  assert.ok(!JSON.stringify(down).includes("neon"));
  const slow = await healthReport({ dbEnabled: true, probe: () => new Promise((r) => setTimeout(r, 500)), timeoutMs: 20, env: {}, now });
  assert.equal(slow.db, "down");
});

test("version accepts only hex shas", () => {
  assert.equal(buildVersion({ RENDER_GIT_COMMIT: "postgres://u:p@h/db" }), null);
  assert.equal(buildVersion({ GIT_COMMIT: "abc1234" }), "abc1234");
});

test("route: public path, 503 on db down, no-store, no env dump", async () => {
  const route = read("src/app/api/health/route.ts");
  assert.match(route, /status: report\.ok \? 200 : 503/);
  assert.match(route, /no-store/);
  assert.ok(!/process\.env/.test(route));
  const { isPublicPath } = await import("../src/lib/auth/paths.ts");
  assert.equal(isPublicPath("/api/health"), true);
});
