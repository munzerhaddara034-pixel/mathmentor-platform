// Postgres integration tests for the card lockdown: withDocumentLock = pg_advisory_xact_lock + SELECT … FOR
// UPDATE in ONE transaction. They run ONLY against a throwaway server given by MM_TEST_PG_URL and are
// skipped otherwise. A fresh database is created per run and dropped afterwards. Refuses to run when a
// DATABASE_URL is already set in the environment, so the production database can never be touched.
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

describe("card lockdown on Postgres", { skip }, () => {
  let pg, admin, pool, dbName, testUrl;
  let dataDir, store, billing, redeem, pgMod;

  const withDb = (url, database) => {
    const parsed = new URL(url);
    parsed.pathname = `/${database}`;
    return parsed.toString();
  };
  const user = (id) => ({
    id,
    email: `${id}@example.com`,
    name: `Student ${id}`,
    role: "student",
    passwordHash: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    subscriptionType: null,
    liveCredits: 0,
    aiExpiresAt: null,
  });
  const setDoc = (key, data) =>
    pool.query(
      `INSERT INTO mm_documents (key, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [key, JSON.stringify(data)],
    );
  const getDoc = async (key) => (await pool.query("SELECT data FROM mm_documents WHERE key = $1", [key])).rows[0]?.data ?? null;
  const resetDocs = async (users = 40) => {
    await pool.query("DELETE FROM mm_documents WHERE key IN ('auth.json', 'billing.json', 'store.json')");
    await setDoc("auth.json", { users: Array.from({ length: users }, (_, i) => user(`u${i}`)), sessions: [], revokedTokens: [] });
  };

  before(async () => {
    pg = (await import("pg")).default;
    admin = new pg.Pool({ connectionString: BASE_URL, max: 2 });
    dbName = `mm_cards_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
    await admin.query(`CREATE DATABASE ${dbName}`);
    testUrl = withDb(BASE_URL, dbName);
    // This test process only: the app's pool now points at the throwaway database.
    process.env.DATABASE_URL = testUrl;
    process.env.PG_IMPORT_LOCAL_FILES = "0";
    process.env.PG_POOL_MAX = "8";
    pool = new pg.Pool({ connectionString: testUrl, max: 6 });
    pgMod = await import("../src/lib/db/pg.ts");
    await pgMod.ensureDatabaseReady();
    dataDir = await import("../src/lib/dataDir.ts");
    store = await import("../src/lib/store.ts");
    billing = await import("../src/lib/billing/store.ts");
    redeem = await import("../src/lib/cards/redeem.ts");
  });

  after(async () => {
    await pgMod?.getPool().end().catch(() => undefined);
    delete process.env.DATABASE_URL;
    await pool?.end().catch(() => undefined);
    if (admin && dbName) await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  });

  test("the app is really on the throwaway Postgres backend", async () => {
    assert.equal(await dataDir.resolveJsonBackend(), "postgres");
    assert.ok(pgMod.databaseUrl().includes(dbName));
  });

  test("withDocumentLock holds the advisory lock AND the document row lock until commit", async () => {
    await resetDocs(2);
    let probe;
    await dataDir.withDocumentLock(["auth.json", "billing.json"], async () => {
      const other = await pool.connect();
      try {
        await other.query("BEGIN");
        const advisory = await other.query("SELECT pg_try_advisory_xact_lock(hashtextextended('mm_documents:' || $1, 0)) AS got", ["auth.json"]);
        const billingAdvisory = await other.query("SELECT pg_try_advisory_xact_lock(hashtextextended('mm_documents:' || $1, 0)) AS got", ["billing.json"]);
        let rowLocked = false;
        try {
          await other.query("SELECT 1 FROM mm_documents WHERE key = 'auth.json' FOR UPDATE NOWAIT");
        } catch (error) {
          rowLocked = error.code === "55P03";
        }
        probe = { advisory: advisory.rows[0].got, billingAdvisory: billingAdvisory.rows[0].got, rowLocked };
      } finally {
        await other.query("ROLLBACK").catch(() => undefined);
        other.release();
      }
    });
    assert.deepEqual(probe, { advisory: false, billingAdvisory: false, rowLocked: true });
    const free = await pool.query("SELECT pg_try_advisory_lock(hashtextextended('mm_documents:auth.json', 0)) AS got");
    assert.equal(free.rows[0].got, true, "released after commit");
    await pool.query("SELECT pg_advisory_unlock(hashtextextended('mm_documents:auth.json', 0))");
  });

  test("a throw inside the lock rolls back every document written in it", async () => {
    await resetDocs(2);
    await setDoc("billing.json", { codes: [], ledger: [] });
    await assert.rejects(
      dataDir.withDocumentLock(["auth.json", "billing.json"], async () => {
        await billing.addLedger({ userId: "u0", kind: "topup", hoursDelta: 1, description: "x", descriptionAr: "x" });
        await dataDir.updateJsonFile("auth.json", null, (doc) => ({ ...doc, users: [] }));
        throw new Error("boom");
      }),
      /boom/,
    );
    assert.equal((await getDoc("billing.json")).ledger.length, 0);
    assert.equal((await getDoc("auth.json")).users.length, 2);
  });

  test("card creation and its mm_audit_log row commit together (audit failure = no cards)", async () => {
    await resetDocs(1);
    const created = await store.createScratchCards(
      { planId: "ai-monthly", count: 3, code: "PG" },
      { audit: (cards) => ({ action: "cards.create", actor: { id: "admin-1", role: "admin" }, target: cards[0].batchId, details: { codes: cards.map((c) => c.code.slice(0, 5) + "•••") } }) },
    );
    assert.equal(created.length, 3);
    const audit = await pool.query("SELECT actor_id, details FROM mm_audit_log WHERE action = 'cards.create' AND target = $1", [created[0].batchId]);
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].actor_id, "admin-1");
    assert.equal((await getDoc("store.json")).scratchCards.length, 3);

    await assert.rejects(
      billing.createTopUpCodes({ liveHours: 2, count: 4 }, { audit: () => ({ action: null }) }),
      "a broken audit entry aborts the creation",
    );
    assert.equal(((await getDoc("billing.json"))?.codes ?? []).length, 0, "no top-up codes without their audit row");
  });

  test("4 processes × 6 concurrent redeems of ONE card and ONE top-up code: exactly one success each", async () => {
    await resetDocs(40);
    const [card] = await store.createScratchCards({ planId: "ai-monthly", count: 1 });
    const [topup] = await billing.createTopUpCodes({ liveHours: 5, count: 1 });
    const dir = mkdtempSync(path.join(tmpdir(), "mm-cards-"));
    const script = path.join(dir, "child.mjs");
    writeFileSync(
      script,
      `const { redeemCode } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/cards/redeem.ts")).href)});
const { getPool } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/db/pg.ts")).href)});
const [card, topup, worker] = process.argv.slice(2);
const jobs = [];
for (let i = 0; i < 6; i += 1) {
  const id = "u" + (Number(worker) * 6 + i);
  jobs.push(redeemCode({ code: card, userId: id, name: id }));
  jobs.push(redeemCode({ code: topup, userId: id, name: id }));
}
const results = await Promise.all(jobs);
await getPool().end();
process.stdout.write(JSON.stringify(results.map((r) => (r.ok ? { ok: true, kind: r.kind } : { ok: false, err: r.errorEn }))));
`,
    );
    const childEnv = { ...process.env, DATABASE_URL: testUrl, PG_IMPORT_LOCAL_FILES: "0", PG_POOL_MAX: "4" };
    const outputs = await Promise.all(
      [0, 1, 2, 3].map((worker) =>
        run(process.execPath, ["--import", REGISTER, script, card.code, topup.code, String(worker)], { env: childEnv, cwd: ROOT, timeout: 60_000 }),
      ),
    );
    const results = outputs.flatMap((out) => JSON.parse(out.stdout));
    assert.equal(results.length, 48);
    const wins = results.filter((r) => r.ok);
    assert.deepEqual(wins.map((r) => r.kind).sort(), ["card", "topup"], JSON.stringify(results));
    assert.ok(results.filter((r) => !r.ok).every((r) => /already used/.test(r.err)), JSON.stringify(results));

    const storeDoc = await getDoc("store.json");
    assert.equal(storeDoc.entitlements.length, 1);
    assert.equal(storeDoc.scratchCards[0].used, true);
    const billingDoc = await getDoc("billing.json");
    assert.equal(billingDoc.codes.find((c) => c.code === topup.code).used, true);
    assert.equal(billingDoc.ledger.length, 2, "one topup row + one activation row");
    const users = (await getDoc("auth.json")).users;
    assert.equal(users.reduce((sum, u) => sum + (u.liveCredits ?? 0), 0), 5, "credited exactly once");
    assert.equal(users.filter((u) => u.entitlementPlanId === "ai-monthly").length, 1);
  });

  test("concurrent top-ups for one user across processes never lose credits", async () => {
    await resetDocs(2);
    const codes = await billing.createTopUpCodes({ liveHours: 1, count: 12 });
    const dir = mkdtempSync(path.join(tmpdir(), "mm-cards-"));
    const script = path.join(dir, "child.mjs");
    writeFileSync(
      script,
      `const { redeemTopUp } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/billing/store.ts")).href)});
const { getPool } = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, "src/lib/db/pg.ts")).href)});
const results = await Promise.all(process.argv.slice(2).map((code) => redeemTopUp(code, "u1", "S1")));
await getPool().end();
process.stdout.write(JSON.stringify(results.map((r) => r.ok)));
`,
    );
    const childEnv = { ...process.env, DATABASE_URL: testUrl, PG_IMPORT_LOCAL_FILES: "0", PG_POOL_MAX: "4" };
    const chunks = [codes.slice(0, 4), codes.slice(4, 8), codes.slice(8)].map((list) => list.map((c) => c.code));
    const outputs = await Promise.all(chunks.map((list) => run(process.execPath, ["--import", REGISTER, script, ...list], { env: childEnv, cwd: ROOT, timeout: 60_000 })));
    assert.ok(outputs.flatMap((out) => JSON.parse(out.stdout)).every(Boolean));
    const u1 = (await getDoc("auth.json")).users.find((u) => u.id === "u1");
    assert.equal(u1.liveCredits, 12);
    assert.equal(u1.subscriptionType, "LIVE_TIER");
  });

  test("redeemCode keeps working for an existing valid card created before the lockdown", async () => {
    await resetDocs(2);
    await setDoc("store.json", {
      library: [],
      drafts: [],
      scratchCards: [{ code: "LEGACY-ABC12", planId: "ai-monthly", used: false, createdAt: "2026-01-01T00:00:00.000Z" }],
      entitlements: [],
    });
    const result = await redeem.redeemCode({ code: "legacy-abc12", userId: "u0", name: "S0" });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.kind, "card");
    assert.equal((await getDoc("auth.json")).users[0].entitlementPlanId, "ai-monthly");
    assert.equal((await redeem.redeemCode({ code: "LEGACY-ABC12", userId: "u1", name: "S1" })).ok, false);
  });
});
