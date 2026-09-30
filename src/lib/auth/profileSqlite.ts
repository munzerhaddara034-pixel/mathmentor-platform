/** SQLite (node:sqlite, data/auth.db) profile repository — the file fallback when DATABASE_URL is unset. */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildProfileSeed } from "./profileSeed";
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

function seedIfEmpty(db: DatabaseSync) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n > 0) return;
  const seed = buildProfileSeed();
  const insertUser = db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, linked_student_id, track, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const u of seed.users) {
    insertUser.run(u.id, u.email, u.name, u.password_hash, u.role, u.linked_student_id, u.track, u.created_at);
  }
  const enroll = db.prepare(
    `INSERT INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  for (const e of seed.enrollments) enroll.run(e.id, e.user_id, e.track, e.progress, e.created_at);
  const progress = db.prepare(
    `INSERT INTO lesson_progress (id, user_id, lesson_id, percent, passed_quiz, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const p of seed.progress) progress.run(p.id, p.user_id, p.lesson_id, p.percent, p.passed_quiz, p.completed_at);
  const reminder = db.prepare(
    `INSERT INTO exam_reminders (id, user_id, track, title, arabic_title, due_at, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of seed.reminders) {
    reminder.run(r.id, r.user_id, r.track, r.title, r.arabic_title, r.due_at, r.href, r.created_at);
  }
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
  seedIfEmpty(db);
  globalForAuth.mmAuthDb = db;
  return db;
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
};
