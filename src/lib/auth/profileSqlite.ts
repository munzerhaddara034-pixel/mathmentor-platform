/** SQLite (node:sqlite, data/auth.db) profile repository — the file fallback when DATABASE_URL is unset. */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  EnrollmentInsert,
  EnrollmentRow,
  LessonProgressRow,
  ProfileRepo,
  ProfileUserRow,
  ReminderRow,
} from "./profileTypes";

const globalForAuth = globalThis as unknown as { mmAuthDb?: DatabaseSync };

function dbPath() {
  return path.join(process.cwd(), "data", "auth.db");
}

function openDb() {
  if (globalForAuth.mmAuthDb) return globalForAuth.mmAuthDb;
  mkdirSync(path.dirname(dbPath()), { recursive: true });
  const db = new DatabaseSync(dbPath());
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      linked_student_id TEXT,
      track TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS enrollments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      track TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, track)
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      percent INTEGER NOT NULL DEFAULT 0,
      passed_quiz INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      UNIQUE(user_id, lesson_id)
    );
    CREATE TABLE IF NOT EXISTS exam_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      track TEXT,
      title TEXT NOT NULL,
      arabic_title TEXT NOT NULL,
      due_at TEXT NOT NULL,
      href TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // redesign-v2 (global platform): additive `locale` column on existing local DBs.
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "locale")) db.exec("ALTER TABLE users ADD COLUMN locale TEXT");
  globalForAuth.mmAuthDb = db;
  return db;
}

/** Opens data/auth.db only when it already exists (never creates an empty DB). */
export function openProfileSqliteIfExists(): DatabaseSync | null {
  if (globalForAuth.mmAuthDb) return globalForAuth.mmAuthDb;
  if (!existsSync(dbPath())) return null;
  return openDb();
}

export const sqliteProfileRepo: ProfileRepo = {
  async findUserByEmail(email) {
    return openDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as ProfileUserRow | undefined;
  },
  async findUserById(id) {
    return openDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as ProfileUserRow | undefined;
  },
  async insertUser(u) {
    openDb()
      .prepare(
        `INSERT INTO users (id, email, name, password_hash, role, linked_student_id, track, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(u.id, u.email, u.name, u.password_hash, u.role, u.linked_student_id, u.track, u.created_at);
  },
  async insertEnrollment(e: EnrollmentInsert, ignoreConflict: boolean) {
    const verb = ignoreConflict ? "INSERT OR IGNORE" : "INSERT";
    openDb()
      .prepare(`${verb} INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(e.id, e.user_id, e.track, e.progress, e.created_at);
  },
  async listEnrollments(userId) {
    return openDb()
      .prepare("SELECT id, user_id, track, progress FROM enrollments WHERE user_id = ?")
      .all(userId) as EnrollmentRow[];
  },
  async listLessonProgress(userId) {
    return openDb()
      .prepare("SELECT lesson_id, percent, passed_quiz, completed_at FROM lesson_progress WHERE user_id = ?")
      .all(userId) as LessonProgressRow[];
  },
  async listReminders(userId) {
    return openDb()
      .prepare(
        `SELECT id, user_id, track, title, arabic_title, due_at, href
         FROM exam_reminders WHERE user_id = ? OR user_id IS NULL ORDER BY due_at ASC`,
      )
      .all(userId) as ReminderRow[];
  },
  async getLocaleByEmail(email) {
    const row = openDb().prepare("SELECT locale FROM users WHERE email = ?").get(email) as { locale: string | null } | undefined;
    return row?.locale ?? null;
  },
  async setLocaleByEmail(email, locale) {
    const result = openDb().prepare("UPDATE users SET locale = ? WHERE email = ?").run(locale, email);
    return Number(result.changes) > 0;
  },
};
