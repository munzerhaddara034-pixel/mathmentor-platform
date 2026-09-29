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
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
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

/** Runs migrations once per process; later calls await the same promise. */
export function ensureDatabaseReady(): Promise<void> {
  if (!isPostgresEnabled()) return Promise.resolve();
  if (!globalForPg.mmPgReady) {
    globalForPg.mmPgReady = (async () => {
      const client = await getPool().connect();
      try {
        const applied = await runMigrations(client);
        if (applied.length) console.info(`[mathmentor] Postgres migrations applied: ${applied.join(", ")}`);
      } finally {
        client.release();
      }
    })().catch((error: unknown) => {
      globalForPg.mmPgReady = undefined;
      throw error;
    });
  }
  return globalForPg.mmPgReady;
}

export async function dbQuery<Row extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<Row[]> {
  await ensureDatabaseReady();
  const result = await getPool().query<Row>(sql, params);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureDatabaseReady();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
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
