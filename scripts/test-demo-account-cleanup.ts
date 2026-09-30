/**
 * Demo-account removal + staff allowlist + signup password policy (file + SQLite stores).
 *   npx tsx scripts/test-demo-account-cleanup.ts
 * Runs in an empty temp cwd with DATABASE_URL removed, so it never touches a real database.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

delete process.env.DATABASE_URL;
delete process.env.ADMIN_EMAILS;
delete process.env.TEAM_APPROVER_EMAILS;
process.chdir(mkdtempSync(path.join(os.tmpdir(), "mm-demo-cleanup-")));

type Case = { name: string; run: () => Promise<void> | void };
const cases: Case[] = [];
const test = (name: string, run: Case["run"]) => cases.push({ name, run });

type Row = { userId?: string; id?: string; email?: string };

async function main() {
  const { readJsonFile, writeJsonFile } = await import("../src/lib/dataDir");
  const authStore = await import("../src/lib/auth/store");
  const { sqliteProfileRepo, openProfileSqliteIfExists } = await import("../src/lib/auth/profileSqlite");
  const cleanup = await import("../src/lib/auth/removeDemoAccounts");
  const allow = await import("../src/lib/auth/adminAllowlist");
  const policy = await import("../src/lib/auth/passwordPolicy");

  const now = new Date().toISOString();
  const seedAuthUser = { id: "user-demo-teacher", email: "teacher@mathmentor.local", name: "seed", role: "teacher", passwordHash: "x:y", createdAt: now };
  const realUser = { id: "user-real-1", email: "real.student@example.com", name: "Real", role: "student", passwordHash: "x:y", createdAt: now };
  // Look-alikes that must survive: same domain, similar local part, staff role.
  const lookalike = { id: "user-real-2", email: "teacher2@mathmentor.local", name: "Look", role: "admin", passwordHash: "x:y", createdAt: now };

  test("empty auth store is not seeded any more", async () => {
    assert.deepEqual(await authStore.listPublicUsers(), []);
    assert.equal(openProfileSqliteIfExists(), null, "no SQLite DB is created just by checking");
  });

  test("seed users + dependent rows removed; non-seed users survive; second run is a no-op", async () => {
    await writeJsonFile("auth.json", {
      users: [seedAuthUser, realUser, lookalike],
      sessions: [
        { id: "s1", userId: seedAuthUser.id, tokenHash: "a", createdAt: now },
        { id: "s2", userId: realUser.id, tokenHash: "b", createdAt: now },
      ],
      revokedTokens: [
        { tokenHash: "c", userId: seedAuthUser.id, replacedAt: now },
        { tokenHash: "d", userId: realUser.id, replacedAt: now },
      ],
    });
    await writeJsonFile("notifications.json", { notifications: [{ id: "n1", userId: seedAuthUser.id }, { id: "n2", userId: realUser.id }] });
    await writeJsonFile("gamification.json", { profiles: [{ userId: seedAuthUser.id }, { userId: realUser.id }] });
    await writeJsonFile("billing.json", { codes: [], ledger: [{ id: "l1", userId: seedAuthUser.id }, { id: "l2", userId: realUser.id }] });

    await sqliteProfileRepo.insertUser({ id: "teacher_seed", email: "teacher@mathmentor.lb", name: "seed", password_hash: "x:y", role: "teacher", linked_student_id: null, track: null, created_at: now });
    await sqliteProfileRepo.insertUser({ id: "student_real", email: "real.student@example.com", name: "Real", password_hash: "x:y", role: "student", linked_student_id: null, track: "grade-12", created_at: now });
    await sqliteProfileRepo.insertEnrollment({ id: "e1", user_id: "teacher_seed", track: "grade-12", progress: 0, created_at: now }, false);
    await sqliteProfileRepo.insertEnrollment({ id: "e2", user_id: "student_real", track: "grade-12", progress: 0, created_at: now }, false);

    const first = await cleanup.removeDemoAccountsOnce();
    assert.equal(first.jsonStores, "ran");
    assert.equal(first.sqlite, "ran");
    assert.equal(first.postgres, "disabled");
    assert.equal(first.counts["auth.users"], 1);
    assert.equal(first.counts["auth.sessions"], 1);
    assert.equal(first.counts["auth.revokedTokens"], 1);
    assert.equal(first.counts["sqlite.users"], 1);
    assert.equal(first.counts["sqlite.enrollments"], 1);

    const auth = await readJsonFile<{ users: Row[]; sessions: Row[]; revokedTokens: Row[] }>("auth.json", { users: [], sessions: [], revokedTokens: [] });
    assert.deepEqual(auth.users.map((u) => u.email).sort(), ["real.student@example.com", "teacher2@mathmentor.local"]);
    assert.deepEqual(auth.sessions.map((s) => s.userId), [realUser.id]);
    assert.deepEqual(auth.revokedTokens.map((s) => s.userId), [realUser.id]);
    const notifs = await readJsonFile<{ notifications: Row[] }>("notifications.json", { notifications: [] });
    assert.deepEqual(notifs.notifications.map((n) => n.userId), [realUser.id]);
    const game = await readJsonFile<{ profiles: Row[] }>("gamification.json", { profiles: [] });
    assert.deepEqual(game.profiles.map((n) => n.userId), [realUser.id]);
    const billing = await readJsonFile<{ ledger: Row[] }>("billing.json", { ledger: [] });
    assert.deepEqual(billing.ledger.map((n) => n.userId), [realUser.id]);

    assert.equal(await sqliteProfileRepo.findUserByEmail("teacher@mathmentor.lb"), undefined);
    assert.equal((await sqliteProfileRepo.findUserByEmail("real.student@example.com"))?.id, "student_real");
    assert.deepEqual((await sqliteProfileRepo.listEnrollments("student_real")).map((e) => e.id), ["e2"]);
    assert.equal(await authStore.findUserByEmail("teacher@mathmentor.local"), undefined);
    assert.equal((await authStore.findUserByEmail("real.student@example.com"))?.id, realUser.id);

    const second = await cleanup.removeDemoAccountsOnce();
    assert.equal(second.jsonStores, "skipped");
    assert.equal(second.sqlite, "skipped");
    assert.deepEqual(second.counts, {});
    const marker = await readJsonFile<{ applied: Array<{ id: string }> }>("data-migrations.json", { applied: [] });
    assert.deepEqual(marker.applied.map((m) => m.id), [cleanup.DEMO_ACCOUNTS_CLEANUP_ID]);
  });

  test("ADMIN_EMAILS allowlist: trimmed, case-insensitive, documented fallback", () => {
    assert.deepEqual(allow.adminEmails(), [allow.DEFAULT_ADMIN_EMAIL]);
    process.env.ADMIN_EMAILS = "  Boss@Example.com , second@example.com,, ";
    assert.equal(allow.isAdminEmail("boss@example.COM "), true);
    assert.equal(allow.isAdminEmail("second@example.com"), true);
    assert.equal(allow.isAdminEmail(allow.DEFAULT_ADMIN_EMAIL), false, "fallback applies only when ADMIN_EMAILS is unset");
    assert.equal(allow.isAdminEmail("boss@example.com.evil.io"), false);
    assert.equal(allow.isTeamApproverEmail("boss@example.com"), true, "TEAM_APPROVER_EMAILS falls back to ADMIN_EMAILS");
    process.env.TEAM_APPROVER_EMAILS = "approver@example.com";
    assert.equal(allow.isTeamApproverEmail("boss@example.com"), false);
    assert.equal(allow.isTeamApproverEmail("APPROVER@example.com"), true);
    delete process.env.ADMIN_EMAILS;
    delete process.env.TEAM_APPROVER_EMAILS;
  });

  test("allowlisted email is promoted on login; other accounts are untouched", async () => {
    process.env.ADMIN_EMAILS = "real.student@example.com";
    const promoted = await authStore.ensureAdminRoleForAllowlistedEmail(realUser.id);
    assert.equal(promoted?.role, "admin");
    const other = await authStore.ensureAdminRoleForAllowlistedEmail(lookalike.id);
    assert.equal(other?.role, "admin", "existing role is kept (never demoted)");
    delete process.env.ADMIN_EMAILS;
    const unlisted = await authStore.ensureUserForProfile({ email: "new.student@example.com", name: "N", role: "student", passwordHash: "x:y" });
    assert.equal((await authStore.ensureAdminRoleForAllowlistedEmail(unlisted.id))?.role, "student");
  });

  test("signup password policy (server-side)", () => {
    assert.equal(policy.checkSignupPassword("short1").ok, false);
    assert.equal(policy.checkSignupPassword("abcdefghij").ok, false, "needs a digit");
    assert.equal(policy.checkSignupPassword("1234567890").ok, false, "needs a letter");
    assert.equal(policy.checkSignupPassword("math2026ok").ok, true);
    assert.equal(policy.checkSignupPassword("رياضيات2026").ok, true, "Arabic letters count");
    const bad = policy.checkSignupPassword("abc");
    assert.ok(!bad.ok && /10/.test(bad.errorAr));
  });

  let failed = 0;
  for (const c of cases) {
    try {
      await c.run();
      console.log(`PASS  ${c.name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${c.name}\n      ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}

void main();
