/**
 * One-time, idempotent startup migration: delete the old seeded demo/test accounts.
 *
 * Matching is by an EXPLICIT hardcoded list of the known seed emails only — never by pattern,
 * role or domain — so no other user is ever touched. Dependent rows are removed only for the
 * user ids of those matched accounts (sessions, revoked-token markers, profile enrollments /
 * lesson progress / exam reminders, notifications, gamification profiles, billing ledger rows,
 * store entitlements).
 *
 * Stores covered:
 * - JSON document stores through the active backend (Postgres `mm_documents`, Netlify Blobs or
 *   data/*.json files) + any local data/*.json import source when the active backend is remote.
 * - Postgres profile tables (mm_profile_users, mm_enrollments, mm_lesson_progress, mm_exam_reminders).
 * - SQLite data/auth.db profile tables, when that file exists.
 *
 * Each store records that it ran (JSON: data-migrations.json; Postgres: mm_schema_migrations;
 * SQLite: mm_data_migrations), so later boots are a no-op. Only row counts are logged.
 */
import { readFile, writeFile } from "node:fs/promises";
import { dataFile, readJsonFile, resolveJsonBackend, withStoreLock, writeJsonFile } from "@/lib/dataDir";
import { isPostgresEnabled, withTransaction } from "@/lib/db/pg";
import { openProfileSqliteIfExists } from "./profileSqlite";

export const DEMO_ACCOUNTS_CLEANUP_ID = "data_001_remove_demo_accounts";

/** Every email that was ever seeded by src/lib/auth/demoAccounts.ts or profileSeedAccounts.ts. */
export const KNOWN_DEMO_SEED_EMAILS: readonly string[] = [
  "student@mathmentor.local",
  "pending@mathmentor.local",
  "parent@mathmentor.local",
  "ai@mathmentor.local",
  "live@mathmentor.local",
  "teacher@mathmentor.local",
  "admin@mathmentor.local",
  "student@mathmentor.lb",
  "teacher@mathmentor.lb",
  "parent@mathmentor.lb",
];

const SEED_EMAILS: ReadonlySet<string> = new Set(KNOWN_DEMO_SEED_EMAILS);
const MARKER_DOC = "data-migrations.json";
const PG_LOCK_KEY = 72_026_931;

/** JSON documents holding rows keyed by `userId`, and the array field that holds them. */
const DEPENDENT_DOCS: ReadonlyArray<{ doc: string; field: string }> = [
  { doc: "notifications.json", field: "notifications" },
  { doc: "gamification.json", field: "profiles" },
  { doc: "billing.json", field: "ledger" },
  { doc: "store.json", field: "entitlements" },
];

export type DemoCleanupCounts = Record<string, number>;

export type DemoCleanupResult = {
  jsonStores: "ran" | "skipped";
  postgres: "ran" | "skipped" | "disabled";
  sqlite: "ran" | "skipped" | "absent";
  counts: DemoCleanupCounts;
};

type JsonRecord = Record<string, unknown>;
type MarkerDoc = { applied: Array<{ id: string; appliedAt: string; counts: DemoCleanupCounts }> };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeedEmail(value: unknown): boolean {
  return typeof value === "string" && SEED_EMAILS.has(value.trim().toLowerCase());
}

function belongsTo(ids: ReadonlySet<string>, entry: unknown): boolean {
  return isRecord(entry) && typeof entry.userId === "string" && ids.has(entry.userId);
}

function add(counts: DemoCleanupCounts, key: string, n: number) {
  if (n > 0) counts[key] = (counts[key] ?? 0) + n;
}

/** auth.json: drop seed users, then their sessions + revoked-token markers. Returns the new doc or null if unchanged. */
function cleanAuthDoc(doc: unknown, ids: Set<string>, counts: DemoCleanupCounts, label: string): JsonRecord | null {
  if (!isRecord(doc) || !Array.isArray(doc.users)) return null;
  const users: unknown[] = doc.users;
  for (const user of users) {
    if (isRecord(user) && isSeedEmail(user.email) && typeof user.id === "string") ids.add(user.id);
  }
  const keptUsers = users.filter((user) => !(isRecord(user) && isSeedEmail(user.email)));
  const sessions: unknown[] = Array.isArray(doc.sessions) ? doc.sessions : [];
  const revoked: unknown[] = Array.isArray(doc.revokedTokens) ? doc.revokedTokens : [];
  const keptSessions = sessions.filter((entry) => !belongsTo(ids, entry));
  const keptRevoked = revoked.filter((entry) => !belongsTo(ids, entry));
  const removed = users.length - keptUsers.length + sessions.length - keptSessions.length + revoked.length - keptRevoked.length;
  add(counts, `${label}auth.users`, users.length - keptUsers.length);
  add(counts, `${label}auth.sessions`, sessions.length - keptSessions.length);
  add(counts, `${label}auth.revokedTokens`, revoked.length - keptRevoked.length);
  if (!removed) return null;
  return {
    ...doc,
    users: keptUsers,
    ...(Array.isArray(doc.sessions) ? { sessions: keptSessions } : {}),
    ...(Array.isArray(doc.revokedTokens) ? { revokedTokens: keptRevoked } : {}),
  };
}

function cleanDependentDoc(
  doc: unknown,
  field: string,
  ids: ReadonlySet<string>,
  counts: DemoCleanupCounts,
  key: string,
): JsonRecord | null {
  if (!ids.size || !isRecord(doc)) return null;
  const rows = doc[field];
  if (!Array.isArray(rows)) return null;
  const list: unknown[] = rows;
  const kept = list.filter((entry) => !belongsTo(ids, entry));
  if (kept.length === list.length) return null;
  add(counts, key, list.length - kept.length);
  return { ...doc, [field]: kept };
}

/** Local data/<name> file used as an import source while Postgres / Blobs is the active backend. */
async function cleanLocalFile(name: string, clean: (doc: unknown) => JsonRecord | null) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(dataFile(name), "utf8")) as unknown;
  } catch {
    return;
  }
  const next = clean(parsed);
  if (next) await writeFile(dataFile(name), JSON.stringify(next, null, 2), "utf8");
}

async function markerApplied(): Promise<boolean> {
  const doc = await readJsonFile<unknown>(MARKER_DOC, null, { persistFallback: false });
  return isRecord(doc) && Array.isArray(doc.applied) && doc.applied.some((item) => isRecord(item) && item.id === DEMO_ACCOUNTS_CLEANUP_ID);
}

async function writeMarker(counts: DemoCleanupCounts) {
  const doc = await readJsonFile<unknown>(MARKER_DOC, null, { persistFallback: false });
  const applied: MarkerDoc["applied"] = isRecord(doc) && Array.isArray(doc.applied) ? (doc.applied as MarkerDoc["applied"]) : [];
  applied.push({ id: DEMO_ACCOUNTS_CLEANUP_ID, appliedAt: new Date().toISOString(), counts });
  await writeJsonFile<MarkerDoc>(MARKER_DOC, { applied });
}

async function cleanPostgresProfiles(ids: Set<string>, counts: DemoCleanupCounts): Promise<"ran" | "skipped"> {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [PG_LOCK_KEY]);
    const done = await client.query("SELECT 1 FROM mm_schema_migrations WHERE id = $1", [DEMO_ACCOUNTS_CLEANUP_ID]);
    if (done.rowCount) return "skipped";
    const emails = [...KNOWN_DEMO_SEED_EMAILS];
    const found = await client.query<{ id: string }>("SELECT id FROM mm_profile_users WHERE email = ANY($1::text[])", [emails]);
    const userIds = found.rows.map((row) => row.id);
    for (const id of userIds) ids.add(id);
    if (userIds.length) {
      for (const table of ["mm_enrollments", "mm_lesson_progress", "mm_exam_reminders"] as const) {
        const res = await client.query(`DELETE FROM ${table} WHERE user_id = ANY($1::text[])`, [userIds]);
        add(counts, `postgres.${table}`, res.rowCount ?? 0);
      }
      const res = await client.query("DELETE FROM mm_profile_users WHERE email = ANY($1::text[])", [emails]);
      add(counts, "postgres.mm_profile_users", res.rowCount ?? 0);
    }
    await client.query(
      "INSERT INTO mm_schema_migrations (id, description) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [DEMO_ACCOUNTS_CLEANUP_ID, "Remove seeded demo accounts (explicit email list) and their dependent rows"],
    );
    return "ran";
  });
}

function cleanSqliteProfiles(ids: Set<string>, counts: DemoCleanupCounts): "ran" | "skipped" | "absent" {
  const db = openProfileSqliteIfExists();
  if (!db) return "absent";
  db.exec("CREATE TABLE IF NOT EXISTS mm_data_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  if (db.prepare("SELECT 1 AS done FROM mm_data_migrations WHERE id = ?").get(DEMO_ACCOUNTS_CLEANUP_ID)) return "skipped";
  const emails = [...KNOWN_DEMO_SEED_EMAILS];
  const emailMarks = emails.map(() => "?").join(", ");
  db.exec("BEGIN");
  try {
    const rows = db.prepare(`SELECT id FROM users WHERE email IN (${emailMarks})`).all(...emails) as Array<{ id: string }>;
    const userIds = rows.map((row) => row.id);
    for (const id of userIds) ids.add(id);
    if (userIds.length) {
      const idMarks = userIds.map(() => "?").join(", ");
      for (const table of ["enrollments", "lesson_progress", "exam_reminders"] as const) {
        const res = db.prepare(`DELETE FROM ${table} WHERE user_id IN (${idMarks})`).run(...userIds);
        add(counts, `sqlite.${table}`, Number(res.changes));
      }
      const res = db.prepare(`DELETE FROM users WHERE email IN (${emailMarks})`).run(...emails);
      add(counts, "sqlite.users", Number(res.changes));
    }
    db.prepare("INSERT OR IGNORE INTO mm_data_migrations (id, applied_at) VALUES (?, ?)").run(
      DEMO_ACCOUNTS_CLEANUP_ID,
      new Date().toISOString(),
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return "ran";
}

async function cleanJsonStores(ids: Set<string>, counts: DemoCleanupCounts): Promise<"ran" | "skipped"> {
  return withStoreLock(MARKER_DOC, async () => {
    if (await markerApplied()) return "skipped";
    const backend = await resolveJsonBackend();
    await withStoreLock("auth.json", async () => {
      const doc = await readJsonFile<unknown>("auth.json", null, { persistFallback: false });
      const next = cleanAuthDoc(doc, ids, counts, "");
      if (next) await writeJsonFile("auth.json", next);
      if (backend !== "filesystem") await cleanLocalFile("auth.json", (local) => cleanAuthDoc(local, ids, counts, "localFile."));
    });
    for (const { doc: name, field } of DEPENDENT_DOCS) {
      await withStoreLock(name, async () => {
        const doc = await readJsonFile<unknown>(name, null, { persistFallback: false });
        const next = cleanDependentDoc(doc, field, ids, counts, `${name}.${field}`);
        if (next) await writeJsonFile(name, next);
        if (backend !== "filesystem") {
          await cleanLocalFile(name, (local) => cleanDependentDoc(local, field, ids, counts, `localFile.${name}.${field}`));
        }
      });
    }
    await writeMarker({ ...counts });
    return "ran";
  });
}

/** Runs every store step once; each step is skipped when its own marker says it already ran. */
export async function removeDemoAccountsOnce(): Promise<DemoCleanupResult> {
  const ids = new Set<string>();
  const counts: DemoCleanupCounts = {};
  const postgres = isPostgresEnabled() ? await cleanPostgresProfiles(ids, counts) : "disabled";
  const sqlite = cleanSqliteProfiles(ids, counts);
  const jsonStores = await cleanJsonStores(ids, counts);
  const ran = postgres === "ran" || sqlite === "ran" || jsonStores === "ran";
  if (ran) {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const detail = Object.entries(counts)
      .map(([key, n]) => `${key}=${n}`)
      .join(" ");
    console.info(
      `[mathmentor] ${DEMO_ACCOUNTS_CLEANUP_ID}: deleted ${total} row(s)${detail ? ` (${detail})` : ""} · json=${jsonStores} postgres=${postgres} sqlite=${sqlite}`,
    );
  }
  return { jsonStores, postgres, sqlite, counts };
}
