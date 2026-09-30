#!/usr/bin/env node
/**
 * npm run db:migrate            → create / update the Postgres schema (idempotent)
 * npm run db:migrate -- --import-files
 *                               → also copy existing ./data/*.json stores (and data/math-queries.json
 *                                 rows) into Postgres. Existing Postgres rows are never overwritten.
 *
 * Requires DATABASE_URL (Neon: postgres://…?sslmode=require). Node ≥ 22.18 (imports the .ts schema directly).
 * Never prints the connection string.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { MIGRATION_LOCK_KEY, MIGRATIONS_TABLE_SQL, SCHEMA_MIGRATIONS } from "../src/lib/db/schema.ts";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL is not set — nothing to migrate (file storage stays active).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
  await client.query(MIGRATIONS_TABLE_SQL);
  for (const migration of SCHEMA_MIGRATIONS) {
    await client.query(migration.sql);
    const res = await client.query(
      "INSERT INTO mm_schema_migrations (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [migration.id, migration.description],
    );
    console.log(`${res.rowCount ? "applied" : "ok     "}  ${migration.id} — ${migration.description}`);
  }
  await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);

  if (process.argv.includes("--import-files")) {
    const dir = path.join(process.cwd(), "data");
    let names = [];
    try {
      names = (await readdir(dir)).filter((name) => name.endsWith(".json"));
    } catch {
      names = [];
    }
    for (const name of names) {
      let data;
      try {
        data = JSON.parse(await readFile(path.join(dir, name), "utf8"));
      } catch {
        console.warn(`skip     ${name} (invalid JSON)`);
        continue;
      }
      if (name === "math-queries.json" && Array.isArray(data?.queries)) {
        let inserted = 0;
        for (const q of data.queries) {
          if (!q?.id) continue;
          const now = new Date().toISOString();
          const r = await client.query(
            `INSERT INTO mm_ai_queries (id, user_id, audit_status, created_at, updated_at, data)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (id) DO NOTHING`,
            [q.id, q.userId ?? null, q.auditStatus ?? null, q.createdAt ?? now, q.updatedAt ?? now, JSON.stringify(q)],
          );
          inserted += r.rowCount ?? 0;
        }
        console.log(`imported ${name} → mm_ai_queries (${inserted} new rows)`);
        continue;
      }
      if (name === "team-chat.json") {
        console.log(`skip     ${name} (team chat file store; Postgres uses mm_team_* tables)`);
        continue;
      }
      const r = await client.query(
        "INSERT INTO mm_documents (key, data) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO NOTHING",
        [name, JSON.stringify(data)],
      );
      console.log(`${r.rowCount ? "imported" : "exists  "} ${name} → mm_documents`);
    }
  }
} finally {
  await client.end();
}
