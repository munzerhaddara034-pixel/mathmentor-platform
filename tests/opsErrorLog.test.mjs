// First-party error log: grouping by fingerprint, scrubbing of personal data, the row cap, the summary
// windows, and the promise that a broken log store never breaks the request it describes.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

describe("ops error log", () => {
  const docs = new Map();
  let storeDown = false;
  const backend = {
    async getJSON(key) {
      if (storeDown) throw new Error("store down");
      return docs.has(key) ? structuredClone(docs.get(key)) : null;
    },
    async setJSON(key, value) {
      if (storeDown) throw new Error("store down");
      docs.set(key, structuredClone(value));
    },
  };
  let dataDir;
  let ops;

  before(async () => {
    dataDir = await import("../src/lib/dataDir.ts");
    dataDir.setPersistentStoreOverride(backend);
    ops = await import("../src/lib/ops/errorLog.ts");
    await import("../src/lib/ops/errorLogStore.ts");
  });
  after(() => {
    ops.setOpsErrorStore(null);
    dataDir.setPersistentStoreOverride(null);
  });
  beforeEach(() => {
    docs.clear();
    storeDown = false;
  });

  test("scrubbing removes addresses, phone numbers, tokens and query strings", () => {
    const scrubbed = ops.scrubErrorText("Failed for monzer@example.com from +961 70 123 456 token github_pat_AbCdEf0123456789abcdefXYZ?secret=1");
    assert.match(scrubbed, /\[email\]/);
    assert.match(scrubbed, /\[token\]/);
    assert.match(scrubbed, /\[redacted\]/);
    assert.doesNotMatch(scrubbed, /monzer@example\.com/);
    assert.doesNotMatch(scrubbed, /github_pat_/);
    assert.doesNotMatch(scrubbed, /secret=1/);
    assert.doesNotMatch(scrubbed, /123 456/);
  });

  test("the same failure with different ids and times is one fingerprint", () => {
    const a = ops.errorFingerprint("route", "Timeout calling provider for student 8812 at 2026-10-09T06:00:00Z");
    const b = ops.errorFingerprint("route", "Timeout calling provider for student 9931 at 2026-10-09T07:30:00Z");
    assert.equal(a, b);
    assert.notEqual(a, ops.errorFingerprint("server", "Timeout calling provider for student 8812 at 2026-10-09T06:00:00Z"));
  });

  test("repeats merge into one row with a counter and a fresh last-seen time", async () => {
    const t0 = new Date("2026-10-09T06:00:00Z");
    await ops.recordOpsError({ message: "Boom 1", source: "route", route: "/api/x", now: t0 });
    await ops.recordOpsError({ message: "Boom 2", source: "route", route: "/api/x", now: new Date(t0.getTime() + 60_000) });
    const rows = await ops.listOpsErrors(10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].count, 2);
    assert.equal(rows[0].lastAt, "2026-10-09T06:01:00.000Z");
    assert.equal(rows[0].route, "/api/x");
  });

  test("the log keeps the newest rows only", async () => {
    // Short, distinct, non-hex, non-token-like tags: the fingerprint must not merge these.
    const tag = (n) => "qwertyuiopasdfghjklzxcvbnm"[n % 26] + "qwertyuiopasdfghjklzxcvbnm"[Math.floor(n / 26) % 26];
    for (let i = 0; i < ops.OPS_ERRORS_MAX + 5; i += 1) {
      await ops.recordOpsError({ message: `Failure ${tag(i)}`, source: "route" });
    }
    assert.equal((await ops.listOpsErrors(ops.OPS_ERRORS_MAX)).length, ops.OPS_ERRORS_MAX);
  });

  test("summary separates the 24-hour window from the 7-day window", async () => {
    const now = new Date("2026-10-09T06:00:00Z");
    await ops.recordOpsError({ message: "Fresh failure", source: "route", now: new Date(now.getTime() - 3_600_000) });
    await ops.recordOpsError({ message: "Older failure", source: "server", now: new Date(now.getTime() - 3 * 86_400_000) });
    const summary = await ops.errorSummary(now);
    assert.equal(summary.total, 2);
    assert.equal(summary.entries, 2);
    assert.equal(summary.last24h, 1);
    assert.equal(summary.last7d, 2);
    assert.deepEqual(summary.bySource.map((row) => row.count), [1, 1]);
    assert.equal(summary.top.length, 2);
  });

  test("the Next.js hook keeps name, message and digest but never the stack", async () => {
    const error = new Error("Provider exploded");
    error.name = "TimeoutError";
    error.digest = "abc123";
    error.stack = "TimeoutError: Provider exploded\n    at /home/ubuntu/cur/src/secret-internal.ts:1:1";
    const entry = await ops.recordRequestError(error, { path: "/api/x?token=1", method: "post" }, { routeType: "route", routePath: "/api/x" });
    assert.equal(entry.source, "route");
    assert.equal(entry.route, "/api/x");
    assert.equal(entry.method, "POST");
    assert.match(entry.message, /TimeoutError: Provider exploded \(abc123\)/);
    assert.doesNotMatch(JSON.stringify(entry), /secret-internal/);
  });

  test("an empty message is not recorded, and a broken store never throws", async () => {
    assert.equal(await ops.recordOpsError({ message: "   " }), null);
    storeDown = true;
    assert.equal(await ops.recordOpsError({ message: "Boom" }), null);
    assert.deepEqual(await ops.listOpsErrors(5), []);
    assert.deepEqual(await ops.errorSummary(), { total: 0, entries: 0, last24h: 0, last7d: 0, bySource: [], top: [] });
    assert.equal(await ops.clearOpsErrors(), 0);
  });

  test("clearing reports how many rows were removed", async () => {
    await ops.recordOpsError({ message: "One", source: "route" });
    await ops.recordOpsError({ message: "Two", source: "server" });
    assert.equal(await ops.clearOpsErrors(), 2);
    assert.deepEqual(await ops.listOpsErrors(5), []);
  });
});
