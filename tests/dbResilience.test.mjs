// Cold-start resilience: a sleeping Postgres (or a pooled socket the server closed while idle) must
// not surface as a false outage to the first visitor, and must never be retried for a statement error.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { healthReport, retryingProbe } from "../src/lib/health.ts";
import { isRetryableConnectionError, retryConnection } from "../src/lib/db/pg.ts";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const noSleep = async () => {};

describe("database cold-start resilience", () => {
  test("only connection-class failures are retryable", () => {
    const connectionErrors = [
      Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      new Error("Connection terminated unexpectedly"),
      new Error("timeout exceeded when trying to connect"),
      new Error("Client has encountered a connection error and is not queryable"),
      new Error("server closed the connection unexpectedly"),
    ];
    for (const error of connectionErrors) assert.equal(isRetryableConnectionError(error), true, error.message);
    const statementErrors = [
      new Error('duplicate key value violates unique constraint "mm_documents_pkey"'),
      new Error("syntax error at or near \"SELEC\""),
      new Error("transaction aborted; nothing was committed"),
      new Error("password authentication failed for user \"neondb_owner\""),
    ];
    for (const error of statementErrors) assert.equal(isRetryableConnectionError(error), false, error.message);
  });

  test("a cold database is retried until it answers", async () => {
    let attempts = 0;
    const value = await retryConnection(async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" });
      return "ready";
    }, { delaysMs: [0, 0, 0] });
    assert.equal(value, "ready");
    assert.equal(attempts, 3);
  });

  test("a statement error is not retried", async () => {
    let attempts = 0;
    await assert.rejects(
      retryConnection(async () => {
        attempts += 1;
        throw new Error("duplicate key value violates unique constraint");
      }, { delaysMs: [0, 0] }),
      /duplicate key/,
    );
    assert.equal(attempts, 1);
  });

  test("retries stop when the delay budget runs out", async () => {
    let attempts = 0;
    await assert.rejects(
      retryConnection(async () => {
        attempts += 1;
        throw new Error("Connection terminated unexpectedly");
      }, { delaysMs: [0, 0] }),
      /Connection terminated/,
    );
    assert.equal(attempts, 3, "initial attempt plus two retries");
  });

  test("the health probe survives a sleeping database", async () => {
    let attempts = 0;
    const probe = () =>
      new Promise((resolve, reject) => {
        attempts += 1;
        // First attempt hangs like a stale pooled socket; the second connects.
        if (attempts === 1) setTimeout(() => reject(new Error("timeout")), 200);
        else resolve("ok");
      });
    const report = await healthReport({
      dbEnabled: true,
      probe: () => retryingProbe(probe, { timeoutsMs: [50, 300], gapMs: 0, sleep: noSleep }),
      timeoutMs: 5_000,
      env: {},
    });
    assert.equal(report.db, "up");
    assert.equal(report.ok, true);
    assert.equal(attempts, 2);
  });

  test("a database that never answers still reports down, without leaking details", async () => {
    let attempts = 0;
    const report = await healthReport({
      dbEnabled: true,
      probe: () =>
        retryingProbe(
          async () => {
            attempts += 1;
            throw new Error("password authentication failed for user neondb_owner at ep-x.neon.tech");
          },
          { timeoutsMs: [50, 50], gapMs: 0, sleep: noSleep },
        ),
      timeoutMs: 5_000,
      env: {},
    });
    assert.equal(report.db, "down");
    assert.equal(report.ok, false);
    assert.equal(attempts, 2);
    assert.ok(!JSON.stringify(report).includes("neon"));
  });

  test("the route retries the probe and keeps its 200/503 contract", () => {
    const route = read("src/app/api/health/route.ts");
    assert.match(route, /retryingProbe/);
    assert.match(route, /status: report\.ok \? 200 : 503/);
    assert.match(route, /no-store/);
    assert.ok(!/process\.env/.test(route), "the route never reads env directly");
    const pg = read("src/lib/db/pg.ts");
    assert.match(pg, /retryConnection\(connectAndMigrate/);
    assert.match(pg, /idleTimeoutMillis: Number\(process\.env\.PG_IDLE_TIMEOUT_MS \|\| 20_000\)/);
    assert.match(pg, /keepAlive: true/);
  });
});
