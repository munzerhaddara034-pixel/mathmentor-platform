// Guest solver trial: a visitor gets a small per-day budget, counted per hashed address inside a
// locked document. Covers the daily reset, per-visitor isolation, the locked read-modify-write under
// concurrency, and the promise that no raw IP ever reaches the store.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

const STORE = "guest-solves.json";

describe("guest solver trial quota", () => {
  const docs = new Map();
  const backend = {
    async getJSON(key) {
      return docs.has(key) ? structuredClone(docs.get(key)) : null;
    },
    async setJSON(key, value) {
      docs.set(key, structuredClone(value));
    },
  };
  let dataDir;
  let quota;

  before(async () => {
    dataDir = await import("../src/lib/dataDir.ts");
    dataDir.setPersistentStoreOverride(backend);
    quota = await import("../src/lib/solver/guestTrial.ts");
  });
  after(() => {
    dataDir.setPersistentStoreOverride(null);
  });
  beforeEach(() => docs.clear());

  test("a fresh visitor gets the full daily budget", async () => {
    const first = await quota.readGuestQuota("203.0.113.7");
    assert.equal(first.limit, quota.GUEST_DAILY_LIMIT);
    assert.equal(first.used, 0);
    assert.equal(first.remaining, quota.GUEST_DAILY_LIMIT);
  });

  test("successful solves are counted, per visitor", async () => {
    for (let i = 1; i <= quota.GUEST_DAILY_LIMIT; i += 1) {
      const after = await quota.recordGuestSolve("203.0.113.7");
      assert.equal(after.used, i);
      assert.equal(after.remaining, quota.GUEST_DAILY_LIMIT - i);
    }
    assert.equal((await quota.readGuestQuota("203.0.113.7")).remaining, 0);
    // Another address keeps its own budget.
    assert.equal((await quota.readGuestQuota("203.0.113.8")).remaining, quota.GUEST_DAILY_LIMIT);
  });

  test("the store keeps only a hash of the address", async () => {
    await quota.recordGuestSolve("203.0.113.7");
    const stored = JSON.stringify(docs.get(STORE));
    assert.ok(!stored.includes("203.0.113.7"), "raw address must not be stored");
    assert.ok(stored.includes(quota.guestKey("203.0.113.7")), "the hashed key is the counter key");
  });

  test("a new day resets the budget", async () => {
    const now = Date.now();
    await quota.recordGuestSolve("203.0.113.7", now);
    assert.equal((await quota.readGuestQuota("203.0.113.7", now + 60_000)).used, 1);
    const tomorrow = await quota.readGuestQuota("203.0.113.7", now + 24 * 60 * 60 * 1000);
    assert.equal(tomorrow.used, 0);
    assert.equal(tomorrow.remaining, quota.GUEST_DAILY_LIMIT);
  });

  test("concurrent solves are all counted (locked read-modify-write)", async () => {
    await Promise.all(Array.from({ length: quota.GUEST_DAILY_LIMIT }, () => quota.recordGuestSolve("203.0.113.9")));
    const quotaAfter = await quota.readGuestQuota("203.0.113.9");
    assert.equal(quotaAfter.used, quota.GUEST_DAILY_LIMIT);
    assert.equal(quotaAfter.remaining, 0);
  });
});
