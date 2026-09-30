/** Postgres profile repository (tables mm_profile_users, mm_enrollments, …) used when DATABASE_URL is set. */
import { dbQuery } from "@/lib/db/pg";
import type {
  EnrollmentRow,
  LessonProgressRow,
  ProfileRepo,
  ProfileUserRow,
  ReminderRow,
} from "./profileTypes";

async function q<Row extends object>(sql: string, params: unknown[]): Promise<Row[]> {
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
  async getLocaleByEmail(email) {
    const rows = await q<{ locale: string | null }>("SELECT locale FROM mm_profile_users WHERE email = $1", [email]);
    return rows[0]?.locale ?? null;
  },
  async setLocaleByEmail(email, locale) {
    const rows = await q<{ id: string }>("UPDATE mm_profile_users SET locale = $1 WHERE email = $2 RETURNING id", [locale, email]);
    return rows.length > 0;
  },
};
