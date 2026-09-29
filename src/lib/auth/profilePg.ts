/** Postgres profile repository (tables mm_profile_users, mm_enrollments, …) used when DATABASE_URL is set. */
import { dbQuery, withTransaction } from "@/lib/db/pg";
import { buildProfileSeed } from "./profileSeed";
import type {
  EnrollmentRow,
  LessonProgressRow,
  ProfileRepo,
  ProfileUserRow,
  ReminderRow,
} from "./profileTypes";

const globalForSeed = globalThis as unknown as { mmPgProfileSeeded?: Promise<void> };

async function seedIfEmpty(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("LOCK TABLE mm_profile_users IN EXCLUSIVE MODE");
    const count = await client.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM mm_profile_users");
    if (Number(count.rows[0]?.n ?? "0") > 0) return;
    const seed = buildProfileSeed();
    for (const u of seed.users) {
      await client.query(
        `INSERT INTO mm_profile_users (id, email, name, password_hash, role, linked_student_id, track, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (email) DO NOTHING`,
        [u.id, u.email, u.name, u.password_hash, u.role, u.linked_student_id, u.track, u.created_at],
      );
    }
    for (const e of seed.enrollments) {
      await client.query(
        `INSERT INTO mm_enrollments (id, user_id, track, progress, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [e.id, e.user_id, e.track, e.progress, e.created_at],
      );
    }
    for (const p of seed.progress) {
      await client.query(
        `INSERT INTO mm_lesson_progress (id, user_id, lesson_id, percent, passed_quiz, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [p.id, p.user_id, p.lesson_id, p.percent, p.passed_quiz, p.completed_at],
      );
    }
    for (const r of seed.reminders) {
      await client.query(
        `INSERT INTO mm_exam_reminders (id, user_id, track, title, arabic_title, due_at, href, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [r.id, r.user_id, r.track, r.title, r.arabic_title, r.due_at, r.href, r.created_at],
      );
    }
  });
}

function ensureSeeded(): Promise<void> {
  globalForSeed.mmPgProfileSeeded ??= seedIfEmpty().catch((error: unknown) => {
    globalForSeed.mmPgProfileSeeded = undefined;
    throw error;
  });
  return globalForSeed.mmPgProfileSeeded;
}

async function q<Row extends object>(sql: string, params: unknown[]): Promise<Row[]> {
  await ensureSeeded();
  return dbQuery<Row & Record<string, unknown>>(sql, params) as Promise<Row[]>;
}

export const pgProfileRepo: ProfileRepo = {
  async findUserByEmail(email) {
    const rows = await q<ProfileUserRow>("SELECT * FROM mm_profile_users WHERE email = $1", [email]);
    return rows[0];
  },
  async findUserById(id) {
    const rows = await q<ProfileUserRow>("SELECT * FROM mm_profile_users WHERE id = $1", [id]);
    return rows[0];
  },
  async insertUser(u) {
    await q(
      `INSERT INTO mm_profile_users (id, email, name, password_hash, role, linked_student_id, track, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [u.id, u.email, u.name, u.password_hash, u.role, u.linked_student_id, u.track, u.created_at],
    );
  },
  async insertEnrollment(e, ignoreConflict) {
    await q(
      `INSERT INTO mm_enrollments (id, user_id, track, progress, created_at) VALUES ($1, $2, $3, $4, $5)
       ${ignoreConflict ? "ON CONFLICT DO NOTHING" : ""}`,
      [e.id, e.user_id, e.track, e.progress, e.created_at],
    );
  },
  async listEnrollments(userId) {
    return q<EnrollmentRow>("SELECT id, user_id, track, progress FROM mm_enrollments WHERE user_id = $1", [userId]);
  },
  async listLessonProgress(userId) {
    return q<LessonProgressRow>(
      "SELECT lesson_id, percent, passed_quiz, completed_at FROM mm_lesson_progress WHERE user_id = $1",
      [userId],
    );
  },
  async listReminders(userId) {
    return q<ReminderRow>(
      `SELECT id, user_id, track, title, arabic_title, due_at, href
       FROM mm_exam_reminders WHERE user_id = $1 OR user_id IS NULL ORDER BY due_at ASC`,
      [userId],
    );
  },
};
