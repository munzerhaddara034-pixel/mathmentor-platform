// Round 2 / item 1 on a throwaway Postgres (MM_TEST_PG_URL only; refuses to run when DATABASE_URL is set).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const BASE_URL = process.env.MM_TEST_PG_URL;
const skip = !BASE_URL
  ? "set MM_TEST_PG_URL to a throwaway Postgres to run these"
  : process.env.DATABASE_URL
    ? "DATABASE_URL is set — refusing to run DB tests (unset it; these use MM_TEST_PG_URL only)"
    : false;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTER = path.join(ROOT, "tests/support/register.mjs");
const run = promisify(execFile);

describe("document locks on Postgres", { skip }, () => {
  let pg, admin, pool, dbName, testUrl, pgMod, dataDir, live;
  const getDoc = async (key) => (await pool.query("SELECT data FROM mm_documents WHERE key = $1", [key])).rows[0]?.data ?? null;

  before(async () => {
    pg = (await import("pg")).default;
    admin = new pg.Pool({ connectionString: BASE_URL, max: 2 });
    dbName = `mm_doclocks_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
    await admin.query(`CREATE DATABASE ${dbName}`);
    const parsed = new URL(BASE_URL);
    parsed.pathname = `/${dbName}`;
    testUrl = parsed.toString();
    process.env.DATABASE_URL = testUrl;
    process.env.PG_IMPORT_LOCAL_FILES = "0";
    pool = new pg.Pool({ connectionString: testUrl, max: 4 });
    pgMod = await import("../src/lib/db/pg.ts");
    await pgMod.ensureDatabaseReady();
    dataDir = await import("../src/lib/dataDir.ts");
    live = await import("../src/lib/live/store.ts");
  });
  after(async () => {
    await pgMod?.getPool().end().catch(() => undefined);
    delete process.env.DATABASE_URL;
    await pool?.end().catch(() => undefined);
    if (admin && dbName) await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  });

  test("a DB error swallowed inside the lock is surfaced (COMMIT→ROLLBACK is not reported as success)", async () => {
    await assert.rejects(
      dataDir.withDocumentLock("swallow.json", async () => {
        await dataDir.writeJsonFile("swallow.json", { a: 1 });
        await dataDir.currentDocumentTransaction().query("SELECT * FROM no_such_table").catch(() => undefined);
      }),
      /transaction aborted/,
    );
    assert.equal(await getDoc("swallow.json"), null, "nothing committed");
  });

  test("first-read fallback is create-if-missing: it never overwrites an existing document", async () => {
    const [a, b] = await Promise.all([
      dataDir.readJsonFile("race.json", { from: "a" }),
      dataDir.readJsonFile("race.json", { from: "b" }),
    ]);
    assert.deepEqual(a, b, "both readers converge on the one stored seed");
    await dataDir.updateJsonFile("race.json", null, () => ({ from: "writer" }));
    assert.deepEqual(await dataDir.readJsonFile("race.json", { from: "late" }), { from: "writer" });
  });

  test("3 processes × 5 concurrent bookings of one 1-seat slot → exactly one booking", async () => {
    const slot = await live.addSlot({ startsAt: new Date(Date.now() + 86_400_000).toISOString(), capacity: 1 });
    const dir = mkdtempSync(path.join(tmpdir(), "mm-live-"));
    const script = path.join(dir, "child.mjs");
    writeFileSync(
      script,
      `const { bookSlot } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/live/store.ts")).href)});
const { getPool } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/db/pg.ts")).href)});
const [slotId, worker] = process.argv.slice(2);
const results = await Promise.all(Array.from({ length: 5 }, (_, i) =>
  bookSlot({ slotId, studentId: "s" + worker + "-" + i, studentName: "S", studentEmail: "", studentPhone: "" })));
await getPool().end();
process.stdout.write(JSON.stringify(results.map((r) => r.ok)));
`,
    );
    const env = { ...process.env, DATABASE_URL: testUrl, PG_IMPORT_LOCAL_FILES: "0", PG_POOL_MAX: "4" };
    const outs = await Promise.all([0, 1, 2].map((w) => run(process.execPath, ["--import", REGISTER, script, slot.id, String(w)], { env, cwd: ROOT, timeout: 60_000 })));
    const oks = outs.flatMap((o) => JSON.parse(o.stdout));
    assert.equal(oks.length, 15);
    assert.equal(oks.filter(Boolean).length, 1);
    const doc = await getDoc("live-sessions.json");
    assert.equal(doc.bookings.filter((b) => b.slotId === slot.id).length, 1);
  });

  test("expired guest holds are released on read (Postgres)", async () => {
    const slot = await live.addSlot({ startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), capacity: 1 });
    const held = await live.bookSlot({ slotId: slot.id, studentId: "guest-abc", studentName: "G", studentEmail: "", studentPhone: "961", status: "pending_payment" });
    assert.equal(held.ok, true);
    assert.ok(!(await live.availableSlots()).some((s) => s.id === slot.id), "held while fresh");
    await dataDir.updateJsonFile("live-sessions.json", null, (doc) => ({
      ...doc,
      bookings: doc.bookings.map((b) => (b.id === held.booking.id ? { ...b, createdAt: new Date(Date.now() - 31 * 60_000).toISOString() } : b)),
    }));
    assert.ok((await live.availableSlots()).some((s) => s.id === slot.id), "released after the TTL");
    const saved = (await getDoc("live-sessions.json")).bookings.find((b) => b.id === held.booking.id);
    assert.equal(saved.status, "cancelled");
    assert.ok(saved.holdExpiredAt);
  });
});
