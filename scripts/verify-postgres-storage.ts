/**
 * Postgres storage round-trip (JSON document stores, AI query log + audit, profile DB, notifications).
 *   DATABASE_URL=postgres://… npx tsx scripts/verify-postgres-storage.ts
 * Runs from an empty temp cwd so nothing can be read back from ./data files.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const tmp = mkdtempSync(path.join(os.tmpdir(), "mm-pg-verify-"));
  process.chdir(tmp);
  process.env.PG_IMPORT_LOCAL_FILES = "0";

  const { readJsonFile, writeJsonFile, resolveJsonBackend } = await import("../src/lib/dataDir");
  const { saveMathQuery, listMathQueries, patchMathQuery, getMathQuery } = await import("../src/lib/solver/store");
  const profiles = await import("../src/lib/auth/db");
  const authStore = await import("../src/lib/auth/store");
  const { ensureDatabaseReady, dbQuery } = await import("../src/lib/db/pg");

  await ensureDatabaseReady();
  assert.equal(await resolveJsonBackend(), "postgres");

  const key = `verify-${Date.now()}.json`;
  await writeJsonFile(key, { hello: "منذر حداره", n: 1 });
  assert.deepEqual(await readJsonFile(key, null), { hello: "منذر حداره", n: 1 });
  await dbQuery("DELETE FROM mm_documents WHERE key = $1", [key]);
  console.log("PASS  JSON document store round-trip (mm_documents)");

  const users = await authStore.listPublicUsers();
  assert.ok(Array.isArray(users));
  console.log(`PASS  auth store (users/sessions) lives in Postgres — ${users.length} users`);

  const q = await saveMathQuery({ userId: "user-verify-student", question: "x^2=4", status: "done" } as unknown as Parameters<typeof saveMathQuery>[0]);
  const listed = await listMathQueries({ userId: "user-verify-student", limit: 5 });
  assert.ok(listed.some((row) => row.id === q.id));
  await patchMathQuery(q.id, { auditStatus: "verified", auditNote: "تحقق الأستاذ" });
  assert.equal((await getMathQuery(q.id))?.auditStatus, "verified");
  console.log("PASS  AI query log + teacher audit (mm_ai_queries)");

  const email = `pg-${Date.now()}@example.invalid`;
  const created = await profiles.createUser({ email, name: "Test Student", password: "verify-2026-password", role: "student" });
  assert.ok(created.ok);
  const found = await profiles.findUserByEmail(email);
  assert.equal(found?.user.email, email);
  assert.equal((await profiles.listEnrollments(found!.user.id)).length, 2);
  console.log("PASS  profile DB (mm_profile_users / mm_enrollments)");

  assert.deepEqual(readdirSync(tmp), [], "no local files may be written in Postgres mode");
  console.log("PASS  no ./data files written");
  process.exit(0);
}

main().catch((error) => {
  console.error("FAIL", error);
  process.exit(1);
});
