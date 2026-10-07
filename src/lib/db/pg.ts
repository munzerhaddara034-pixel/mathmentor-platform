/**
 * Postgres connection (Neon free tier or any Postgres) — active only when DATABASE_URL is set.
 * Without DATABASE_URL every store keeps the original file / SQLite / Netlify Blobs behaviour.
 */
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { MIGRATION_LOCK_KEY, MIGRATIONS_TABLE_SQL, SCHEMA_MIGRATIONS } from "./schema";

type PgGlobal = {
  mmPgPool?: Pool;
  mmPgReady?: Promise<void>;
};

const globalForPg = globalThis as unknown as PgGlobal;

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "";
}

/** True when the Postgres backend should be used (DATABASE_URL present, not during `next build`). */
export function isPostgresEnabled(): boolean {
  if (!databaseUrl()) return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

export function getPool(): Pool {
  if (globalForPg.mmPgPool) return globalForPg.mmPgPool;
  const pool = new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.PG_POOL_MAX || 5),
    // A sleeping Neon compute drops idle sockets; recycling ours sooner avoids handing a dead
    // connection to the first request after a quiet period.
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 20_000),
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
  });
  pool.on("error", (error) => {
    console.error("[mathmentor] Postgres pool error:", error.message);
  });
  globalForPg.mmPgPool = pool;
  return pool;
}

/** Applies every schema migration idempotently (advisory-locked). */
export async function runMigrations(client: PoolClient): Promise<string[]> {
  const applied: string[] = [];
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  try {
    await client.query(MIGRATIONS_TABLE_SQL);
    for (const migration of SCHEMA_MIGRATIONS) {
      await client.query(migration.sql);
      const result = await client.query(
        `INSERT INTO mm_schema_migrations (id, description) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [migration.id, migration.description],
      );
      if (result.rowCount) applied.push(migration.id);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
  }
  return applied;
}

/**
 * Connection-class failures worth another try: a sleeping database, a socket the server closed while
 * we were idle, or a cold start that refused the very first connection. Statement-level errors (bad
 * SQL, constraint violations, aborted transactions) are never retried.
 */
const RETRYABLE_CONNECTION_ERROR = /ECONNRESET|ETIMEDOUT|ECONNREFUSED|EPIPE|ENOTFOUND|Connection terminated|Connection ended|server closed the connection|Client has encountered a connection error|timeout exceeded when trying to connect|terminating connection due to administrator command/i;

export function isRetryableConnectionError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_CONNECTION_ERROR.test(`${code} ${message}`);
}

/** Delays between connection attempts: short first, then longer, so a cold database has time to wake. */
function retryDelays(): number[] {
  const raw = process.env.PG_CONNECT_DELAYS_MS;
  const parsed = raw ? raw.split(",").map((value) => Number(value.trim())) : [];
  const delays = parsed.filter((value) => Number.isFinite(value) && value >= 0);
  return delays.length ? delays : [400, 1_500, 4_000];
}

/**
 * Runs `attempt` until it succeeds, retrying connection-class failures only. Used for the first
 * connection (cold Neon) and wherever a transient socket failure must not reach a visitor.
 */
export async function retryConnection<T>(
  attempt: () => Promise<T>,
  opts: { delaysMs?: number[]; onRetry?: (error: unknown, attemptNumber: number) => void } = {},
): Promise<T> {
  const delays = opts.delaysMs ?? retryDelays();
  for (let index = 0; ; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      const delay = delays[index];
      if (delay === undefined || !isRetryableConnectionError(error)) throw error;
      opts.onRetry?.(error, index + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function connectAndMigrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    const applied = await runMigrations(client);
    if (applied.length) console.info(`[mathmentor] Postgres migrations applied: ${applied.join(", ")}`);
  } finally {
    client.release();
  }
}

/** Runs migrations once per process; later calls await the same promise. */
export function ensureDatabaseReady(): Promise<void> {
  if (!isPostgresEnabled()) return Promise.resolve();
  if (!globalForPg.mmPgReady) {
    globalForPg.mmPgReady = retryConnection(connectAndMigrate, {
      onRetry: (error, attemptNumber) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[mathmentor] Postgres connect attempt ${attemptNumber} failed, retrying: ${message}`);
      },
    }).catch((error: unknown) => {
      globalForPg.mmPgReady = undefined;
      throw error;
    });
  }
  return globalForPg.mmPgReady;
}

export async function dbQuery<Row extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<Row[]> {
  await ensureDatabaseReady();
  try {
    const result = await getPool().query<Row>(sql, params);
    return result.rows;
  } catch (error) {
    // One retry for a connection-class failure only. Statement errors keep their meaning, and the
    // document stores write idempotent upserts, so replaying a single statement is safe.
    if (!isRetryableConnectionError(error)) throw error;
    const result = await retryConnection(() => getPool().query<Row>(sql, params), { delaysMs: [0] });
    return result.rows;
  }
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureDatabaseReady();
  // Only acquiring the connection is retried: once BEGIN has run, replaying the transaction could
  // double-apply a payment, so a failure inside it is surfaced to the caller instead.
  const client = await retryConnection(() => getPool().connect(), { delaysMs: [300, 1_500] });
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    const committed = await client.query("COMMIT");
    // A statement that failed inside `fn` (even if its error was caught) aborts the transaction and
    // Postgres answers COMMIT with ROLLBACK: surface that instead of reporting success.
    if ((committed as { command?: string }).command === "ROLLBACK") throw new Error("[mathmentor] transaction aborted; nothing was committed");
    return value;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export type StorageBackendName = "postgres" | "blobs" | "filesystem";

/** Human-readable status for health/admin panels (never exposes the URL). */
export async function postgresStatus(): Promise<{ enabled: boolean; ok: boolean; error?: string }> {
  if (!isPostgresEnabled()) return { enabled: false, ok: false };
  try {
    await dbQuery("SELECT 1 AS ok");
    return { enabled: true, ok: true };
  } catch (error) {
    return { enabled: true, ok: false, error: error instanceof Error ? error.message.slice(0, 160) : "error" };
  }
}
