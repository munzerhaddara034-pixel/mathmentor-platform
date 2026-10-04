// Postgres integration tests for the payment tables (007 / 008). They run ONLY against a throwaway
// database given by MM_TEST_PG_URL (e.g. postgres://user@127.0.0.1:55432/postgres) and are skipped
// otherwise. They never read DATABASE_URL. A fresh database is created per run and dropped afterwards.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const BASE_URL = process.env.MM_TEST_PG_URL;
const skip = !BASE_URL ? "set MM_TEST_PG_URL to a throwaway Postgres to run these" : false;

const DAY = 24 * 60 * 60 * 1000;
const ADMIN = { id: "admin-1", email: "admin@example.com", role: "admin" };

describe("payments on Postgres", { skip }, () => {
  let pg;
  let admin; // pool on the server's maintenance DB (create / drop the test DB)
  let pool; // pool on the fresh test DB
  let dbName;
  let testUrl;
  let db;
  let runMigrations;
  let validatePaymentClaim;
  let AUTH_DOCUMENT_KEY;

  const withUrl = (url, database, user) => {
    const parsed = new URL(url);
    parsed.pathname = `/${database}`;
    if (user) {
      parsed.username = user;
      parsed.password = "";
    }
    return parsed.toString();
  };

  const migrate = async () => {
    const client = await pool.connect();
    try {
      return await runMigrations(client);
    } finally {
      client.release();
    }
  };

  const seedUsers = async (users) => {
    const doc = { users, sessions: [], revokedTokens: [] };
    await pool.query(
      `INSERT INTO mm_documents (key, data) VALUES ($1, $2::jsonb)
       ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [AUTH_DOCUMENT_KEY, JSON.stringify(doc)],
    );
  };
  const student = (id, over = {}) => ({
    id,
    email: `${id}@example.com`,
    name: `Student ${id}`,
    role: "student",
    passwordHash: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });
  const authUser = async (id) => {
    const result = await pool.query("SELECT data FROM mm_documents WHERE key = $1", [AUTH_DOCUMENT_KEY]);
    return result.rows[0].data.users.find((user) => user.id === id);
  };

  let seq = 0;
  const submit = async (userId, { receipt = null, ...over } = {}) => {
    seq += 1;
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(now);
    const check = validatePaymentClaim(
      {
        payerName: "Test Student",
        payerEmail: "s@example.com",
        plan: "both",
        period: "monthly",
        amount: "40",
        method: "whish",
        reference: `REF${seq}${randomBytes(3).toString("hex")}`,
        transferDate: today,
        ...over,
      },
      now,
    );
    assert.equal(check.ok, true, JSON.stringify(check));
    return db.insertPayment(pool, {
      id: `pay_${seq}_${randomBytes(4).toString("hex")}`,
      userId,
      claim: check.value,
      expectedAmountUsd: 40,
      plan: check.value.plan,
      receipt,
      actor: { id: userId, role: "student" },
    });
  };
  const auditCount = async (action, target) =>
    (await pool.query("SELECT count(*)::int AS n FROM mm_audit_log WHERE action = $1 AND target = $2", [action, target])).rows[0].n;

  before(async () => {
    pg = (await import("pg")).default;
    ({ runMigrations } = await import("../src/lib/db/pg.ts"));
    db = await import("../src/lib/payments/db.ts");
    ({ validatePaymentClaim } = await import("../src/lib/payments/validation.ts"));
    ({ AUTH_DOCUMENT_KEY } = await import("../src/lib/auth/store.ts"));
    admin = new pg.Pool({ connectionString: BASE_URL, max: 2 });
    dbName = `mm_payments_test_${Date.now()}_${randomBytes(3).toString("hex")}`;
    await admin.query(`CREATE DATABASE ${dbName}`);
    testUrl = withUrl(BASE_URL, dbName);
    pool = new pg.Pool({ connectionString: testUrl, max: 12 });
  });

  after(async () => {
    await pool?.end().catch(() => undefined);
    if (admin && dbName) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
      await admin.query("DROP ROLE IF EXISTS mm_finance_ro").catch(() => undefined);
    }
    await admin?.end().catch(() => undefined);
  });

  test("migrations apply on an empty DB and re-run cleanly (every boot)", async () => {
    const first = await migrate();
    assert.ok(first.includes("007_payments") && first.includes("008_finance_views"), first.join(","));
    const second = await migrate();
    assert.deepEqual(second, [], "second run applies nothing new and does not fail");
    const columns = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'mm_payments' ORDER BY ordinal_position",
    );
    assert.deepEqual(
      columns.rows.map((row) => row.column_name),
      [
        "id", "user_id", "payer_name", "payer_email", "payer_phone", "plan", "period", "pricing_region",
        "expected_amount_usd", "amount", "currency", "method", "reference", "reference_raw", "transfer_date",
        "receipt_url", "order_id", "status", "submitted_at", "reviewed_at", "reviewed_by", "note",
        "period_start", "period_end", "owner_notified_at", "student_notified_at",
      ],
    );
    const idx = await pool.query("SELECT indexdef FROM pg_indexes WHERE indexname = 'mm_payments_method_reference_active'");
    assert.match(idx.rows[0].indexdef, /UNIQUE INDEX .* WHERE \(status = ANY \(ARRAY\['pending'::text, 'confirmed'::text\]\)\)/);
  });

  test("currency CHECK rejects LBP at the database level", async () => {
    await assert.rejects(
      pool.query(
        `INSERT INTO mm_payments (id, user_id, payer_name, payer_email, plan, expected_amount_usd, amount, currency, method, reference, reference_raw, transfer_date)
         VALUES ('lbp', 'u', 'Name', 'a@b.co', 'both', 1, 1, 'LBP', 'whish', 'LBP123', 'lbp123', CURRENT_DATE)`,
      ),
      /mm_payments_currency_check|check constraint/,
    );
  });

  test("no auto-activation: submitting a claim leaves the auth document untouched", async () => {
    await seedUsers([student("u-noauto"), student("u-dup"), student("u-par"), student("u-lock"), student("u-rej")]);
    const before = await authUser("u-noauto");
    const payment = await submit("u-noauto");
    assert.equal(payment.status, "pending");
    assert.equal(payment.periodEnd, null);
    assert.deepEqual(await authUser("u-noauto"), before, "auth.json unchanged by a submission");
    assert.equal(await auditCount("payment.submit", payment.id), 1);
  });

  test("duplicate reference → 409 while pending/confirmed; allowed again after a rejection", async () => {
    const first = await submit("u-dup", { reference: "dup777", plan: "both" });
    await assert.rejects(submit("u-noauto", { reference: " DUP 777 ", plan: "ai" }), (error) => error.code === "duplicate_reference" && error.status === 409);
    // Same reference on the other method is a different transfer.
    await submit("u-noauto", { reference: "DUP777", method: "omt", plan: "live" });
    await db.rejectPayment(pool, { paymentId: first.id, admin: ADMIN, note: "Not in Whish history" });
    const again = await submit("u-dup", { reference: "DUP777", plan: "both" });
    assert.equal(again.status, "pending", "resubmission after rejection is allowed");
    await db.confirmPayment(pool, { paymentId: again.id, admin: ADMIN });
    await assert.rejects(submit("u-noauto", { reference: "DUP777", plan: "ai_term" }), (error) => error.code === "duplicate_reference");
  });

  test("one pending claim per student and plan", async () => {
    await submit("u-rej", { plan: "both" });
    await assert.rejects(submit("u-rej", { plan: "both" }), (error) => error.code === "pending_exists" && error.status === 409);
  });

  test("idempotent confirm: 10 parallel confirms apply credits and expiry exactly once with one audit row", async () => {
    const userBefore = await authUser("u-par");
    assert.equal(userBefore.liveCredits ?? 0, 0);
    const payment = await submit("u-par", { plan: "both" });
    const started = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => db.confirmPayment(pool, { paymentId: payment.id, admin: ADMIN })),
    );
    assert.ok(results.every((r) => r.status === "fulfilled"), JSON.stringify(results.filter((r) => r.status === "rejected").map((r) => String(r.reason))));
    const fresh = results.filter((r) => !r.value.alreadyConfirmed);
    assert.equal(fresh.length, 1, "exactly one confirm did the work");
    const user = await authUser("u-par");
    assert.equal(user.liveCredits, 8, "both plan adds 8 live hours once");
    const expiry = Date.parse(user.aiExpiresAt);
    assert.ok(Math.abs(expiry - (started + 30 * DAY)) < 60_000, "monthly = 30 days from now");
    assert.equal(await auditCount("payment.confirm", payment.id), 1);
    const row = await db.getPayment(pool, payment.id);
    assert.equal(row.status, "confirmed");
    assert.equal(row.reviewedBy, ADMIN.id);
    assert.equal(Date.parse(row.periodEnd), expiry);
  });

  test("expiry extends from the current active expiry (term = 90 days)", async () => {
    const active = new Date(Date.now() + 20 * DAY).toISOString();
    await seedUsers([...(await pool.query("SELECT data FROM mm_documents WHERE key=$1", [AUTH_DOCUMENT_KEY])).rows[0].data.users, student("u-ext", { aiExpiresAt: active, subscriptionType: "AI_TIER" })]);
    const payment = await submit("u-ext", { plan: "ai", period: "term" });
    const result = await db.confirmPayment(pool, { paymentId: payment.id, admin: ADMIN });
    assert.equal(result.alreadyConfirmed, false);
    const user = await authUser("u-ext");
    assert.equal(Date.parse(user.aiExpiresAt), Date.parse(active) + 90 * DAY);
  });

  test("cross-instance: a confirm waits on another instance's row lock, then changes nothing", async () => {
    const payment = await submit("u-lock", { plan: "both" });
    const before = await authUser("u-lock");
    const other = await pool.connect();
    let settled = false;
    let pending;
    try {
      await other.query("BEGIN");
      await other.query("SELECT id FROM mm_payments WHERE id = $1 FOR UPDATE", [payment.id]);
      pending = db.confirmPayment(pool, { paymentId: payment.id, admin: ADMIN }).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(settled, false, "confirm is blocked by the other instance's lock");
      // The "other instance" confirms first (as its own confirm would) and commits.
      await other.query(
        `UPDATE mm_payments SET status = 'confirmed', reviewed_at = now(), reviewed_by = 'admin-2',
                period_start = now(), period_end = now() + interval '30 days' WHERE id = $1`,
        [payment.id],
      );
      await other.query("COMMIT");
    } finally {
      other.release();
    }
    const result = await pending;
    assert.equal(result.alreadyConfirmed, true);
    assert.deepEqual(await authUser("u-lock"), before, "no second activation");
    assert.equal(await auditCount("payment.confirm", payment.id), 0);
  });

  test("confirm after reject → 409; reject after confirm → 409; repeat reject is a no-op", async () => {
    const rejected = await submit("u-rej", { plan: "ai" });
    await db.rejectPayment(pool, { paymentId: rejected.id, admin: ADMIN, note: "no transfer" });
    const again = await db.rejectPayment(pool, { paymentId: rejected.id, admin: ADMIN, note: "no transfer" });
    assert.equal(again.alreadyRejected, true);
    assert.equal(await auditCount("payment.reject", rejected.id), 1);
    await assert.rejects(db.confirmPayment(pool, { paymentId: rejected.id, admin: ADMIN }), (error) => error.code === "already_rejected" && error.status === 409);

    const confirmed = await submit("u-rej", { plan: "live" });
    await db.confirmPayment(pool, { paymentId: confirmed.id, admin: ADMIN });
    await assert.rejects(db.rejectPayment(pool, { paymentId: confirmed.id, admin: ADMIN, note: "x" }), (error) => error.code === "already_confirmed" && error.status === 409);
    await assert.rejects(db.confirmPayment(pool, { paymentId: "missing", admin: ADMIN }), (error) => error.code === "not_found");
  });

  test("DB constraints: rejected rows need a note; confirmed rows need a period", async () => {
    const p = await submit("u-rej", { plan: "ai_term" });
    await assert.rejects(pool.query("UPDATE mm_payments SET status='rejected', reviewed_at=now(), reviewed_by='a' WHERE id=$1", [p.id]), /mm_payments_rejected_chk/);
    await assert.rejects(pool.query("UPDATE mm_payments SET status='confirmed', reviewed_at=now(), reviewed_by='a' WHERE id=$1", [p.id]), /mm_payments_confirmed_chk/);
  });

  test("receipts: stored with the claim, flagged when reused, purged 12 months after review", async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const receipt = { mimeType: "image/jpeg", sizeBytes: bytes.length, sha256: "a".repeat(64), bytes };
    const p1 = await submit("u-noauto", { plan: "ai_term", receipt });
    const p2 = await submit("u-ext", { plan: "both", receipt });
    const got = await db.getReceipt(pool, p1.id);
    assert.equal(got.userId, "u-noauto");
    assert.deepEqual(Buffer.from(got.bytes), bytes);
    const rows = await db.listPaymentsForAdmin(pool, { status: "pending" });
    assert.equal(rows.find((r) => r.id === p2.id).duplicateReceiptCount, 1);
    await db.rejectPayment(pool, { paymentId: p1.id, admin: ADMIN, note: "dup image" });
    assert.equal(await db.purgeExpiredReceipts(pool, new Date(Date.now() + 11 * 30 * DAY)), 0, "kept inside 12 months");
    assert.equal(await db.purgeExpiredReceipts(pool, new Date(Date.now() + 367 * DAY)), 1, "purged after 12 months");
    const purged = await db.getReceipt(pool, p1.id);
    assert.equal(purged.purged, true);
    assert.equal(purged.bytes, null);
    assert.equal((await db.getReceipt(pool, p2.id)).purged, false, "pending receipts are never purged");
  });

  test("finance role: mm_finance_ro reads the view and mm_payments only (read-only)", async () => {
    await admin.query("DROP ROLE IF EXISTS mm_finance_ro").catch(() => undefined);
    await admin.query("CREATE ROLE mm_finance_ro LOGIN CONNECTION LIMIT 3");
    await admin.query("ALTER ROLE mm_finance_ro SET default_transaction_read_only = on");
    await admin.query("ALTER ROLE mm_finance_ro SET statement_timeout = '15s'");
    await migrate(); // 008 re-runs on every boot and now finds the role
    const ro = new pg.Client({ connectionString: withUrl(BASE_URL, dbName, "mm_finance_ro") });
    await ro.connect();
    try {
      const view = await ro.query("SELECT user_id, finance_status, paid_until, lifetime_paid_usd FROM mm_finance_subscriptions ORDER BY user_id");
      const par = view.rows.find((row) => row.user_id === "u-par");
      assert.equal(par.finance_status, "active");
      assert.equal(Number(par.lifetime_paid_usd), 40);
      assert.ok(view.rows.some((row) => row.finance_status === "never_paid"));
      const payments = await ro.query("SELECT count(*)::int AS n FROM mm_payments");
      assert.ok(payments.rows[0].n > 0);
      await assert.rejects(ro.query("SELECT * FROM mm_documents LIMIT 1"), /permission denied/);
      await assert.rejects(ro.query("SELECT * FROM mm_payment_receipts LIMIT 1"), /permission denied/);
      await assert.rejects(ro.query("SELECT * FROM mm_audit_log LIMIT 1"), /permission denied/);
      await assert.rejects(ro.query("UPDATE mm_payments SET note = 'x'"), /read-only transaction|permission denied/);
      const readOnly = await ro.query("SHOW default_transaction_read_only");
      assert.equal(readOnly.rows[0].default_transaction_read_only, "on");
    } finally {
      await ro.end();
    }
  });
});
