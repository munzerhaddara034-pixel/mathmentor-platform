/**
 * Role-dashboard profile store (linked student, track, enrollments, lesson progress, reminders).
 * Postgres when DATABASE_URL is set (persistent on Render/Neon), otherwise SQLite data/auth.db.
 */
import { createId } from "@/lib/ids";
import { isPostgresEnabled } from "@/lib/db/pg";
import { hashPassword } from "./password";
import { pgProfileRepo } from "./profilePg";
import { sqliteProfileRepo } from "./profileSqlite";
import type { EnrollmentRow, LessonProgressRow, ProfileRepo, ProfileUserRow, ReminderRow } from "./profileTypes";
import { isUserRole, type SessionUser, type UserRole } from "./types";

function repo(): ProfileRepo {
  return isPostgresEnabled() ? pgProfileRepo : sqliteProfileRepo;
}

function toSessionUser(row: ProfileUserRow): SessionUser {
  const role: UserRole = isUserRole(row.role) ? row.role : "student";
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    linkedStudentId: row.linked_student_id,
    track: row.track,
  };
}

export async function findUserByEmail(email: string) {
  const row = await repo().findUserByEmail(email.trim().toLowerCase());
  if (!row) return undefined;
  return { user: toSessionUser(row), passwordHash: row.password_hash };
}

export async function findUserById(id: string) {
  const row = await repo().findUserById(id);
  return row ? toSessionUser(row) : undefined;
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  track?: string | null;
  linkedStudentEmail?: string | null;
}) {
  const store = repo();
  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) {
    return { ok: false as const, error: "هذا البريد مسجّل مسبقاً" };
  }
  let linkedStudentId: string | null = null;
  if (input.role === "parent" && input.linkedStudentEmail) {
    const linked = await findUserByEmail(input.linkedStudentEmail);
    if (!linked || linked.user.role !== "student") {
      return { ok: false as const, error: "لم نجد طالباً بهذا البريد لربطه" };
    }
    linkedStudentId = linked.user.id;
  }
  const id = createId(input.role);
  const now = new Date().toISOString();
  await store.insertUser({
    id,
    email,
    name: input.name.trim(),
    password_hash: hashPassword(input.password),
    role: input.role,
    linked_student_id: linkedStudentId,
    track: input.track ?? (input.role === "student" ? "grade-12" : null),
    created_at: now,
  });
  if (input.role === "student") {
    const track = input.track || "grade-12";
    await store.insertEnrollment({ id: createId("enr"), user_id: id, track, progress: 0, created_at: now }, false);
    if (track === "grade-12") {
      await store.insertEnrollment(
        { id: createId("enr"), user_id: id, track: "grade-9", progress: 0, created_at: now },
        true,
      );
    }
  }
  const user = await findUserById(id);
  if (!user) return { ok: false as const, error: "تعذر إنشاء الحساب" };
  return { ok: true as const, user };
}

export async function listEnrollments(userId: string): Promise<EnrollmentRow[]> {
  return repo().listEnrollments(userId);
}

export async function listLessonProgress(userId: string): Promise<LessonProgressRow[]> {
  return repo().listLessonProgress(userId);
}

export async function listReminders(userId: string, track?: string | null): Promise<ReminderRow[]> {
  const rows = await repo().listReminders(userId);
  if (!track) return rows;
  return rows.filter((row) => !row.track || row.track === track);
}

export async function asProgressEntries(userId: string) {
  const rows = await listLessonProgress(userId);
  return rows.map((row) => ({
    lessonId: row.lesson_id,
    completedAt: row.completed_at ?? new Date().toISOString(),
    score: row.percent,
    passedQuiz: row.passed_quiz === 1,
  }));
}
