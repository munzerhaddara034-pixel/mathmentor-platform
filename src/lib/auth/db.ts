import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEMO_PROMO_CODES } from "@/lib/access";
import { createId } from "@/lib/ids";
import { hashPassword } from "./password";
import { DEMO_ACCOUNTS, isUserRole, type SessionUser, type UserRole } from "./types";

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  linked_student_id: string | null;
  track: string | null;
  phone: string | null;
  created_at: string;
};

type EnrollmentRow = {
  id: string;
  user_id: string;
  track: string;
  progress: number;
};

type LessonProgressRow = {
  lesson_id: string;
  percent: number;
  passed_quiz: number;
  completed_at: string | null;
};

type ReminderRow = {
  id: string;
  user_id: string | null;
  track: string | null;
  title: string;
  arabic_title: string;
  due_at: string;
  href: string | null;
};

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
      phone TEXT,
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
    CREATE TABLE IF NOT EXISTS promo_codes (
      code TEXT PRIMARY KEY,
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      batch_id TEXT,
      note TEXT,
      redeemed_by TEXT,
      redeemed_at TEXT,
      redeemed_name TEXT,
      redeemed_phone TEXT
    );
    CREATE TABLE IF NOT EXISTS user_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scope_kind TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      source_code TEXT,
      unlocked_at TEXT NOT NULL,
      UNIQUE(user_id, scope_kind, scope_id)
    );
    CREATE TABLE IF NOT EXISTS content_overrides (
      key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      title TEXT,
      arabic_title TEXT,
      video_url TEXT,
      video_url_fr TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "users", "phone", "TEXT");
  seedIfEmpty(db);
  seedDemoPromoCodes(db);
  backfillDemoPhones(db);
  globalForAuth.mmAuthDb = db;
  return db;
}

function tableColumns(db: DatabaseSync, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function ensureColumn(db: DatabaseSync, table: string, column: string, ddl: string) {
  if (tableColumns(db, table).has(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function getAuthDb() {
  return openDb();
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function seedIfEmpty(db: DatabaseSync) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (count.n > 0) return;

  const now = new Date().toISOString();
  const insertUser = db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, linked_student_id, track, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ids: Record<string, string> = {};
  for (const account of DEMO_ACCOUNTS) {
    const id = createId(account.role);
    ids[account.role] = id;
    insertUser.run(
      id,
      account.email.toLowerCase(),
      account.name,
      hashPassword(account.password),
      account.role,
      null,
      account.track,
      account.phone ?? null,
      now,
    );
  }
  db.prepare("UPDATE users SET linked_student_id = ? WHERE id = ?").run(ids.student, ids.parent);

  const enroll = db.prepare(
    `INSERT INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  enroll.run(createId("enr"), ids.student, "grade-12", 38, now);
  enroll.run(createId("enr"), ids.student, "grade-9", 22, now);

  const progress = db.prepare(
    `INSERT INTO lesson_progress (id, user_id, lesson_id, percent, passed_quiz, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  progress.run(createId("lp"), ids.student, "grade-12-ch1", 100, 1, now);
  progress.run(createId("lp"), ids.student, "grade-12-ch2", 70, 1, now);
  progress.run(createId("lp"), ids.student, "grade-12-ch3", 40, 0, now);
  progress.run(createId("lp"), ids.student, "grade-9-ch4", 55, 0, now);

  const reminder = db.prepare(
    `INSERT INTO exam_reminders (id, user_id, track, title, arabic_title, due_at, href, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  reminder.run(
    createId("ex"),
    ids.student,
    "grade-12",
    "Continuity checkpoint",
    "اختبار الاستمرار",
    daysFromNow(4),
    "/quiz/grade-12-ch2",
    now,
  );
  reminder.run(
    createId("ex"),
    ids.student,
    "grade-12",
    "LS functions contest",
    "مسابقة دراسة الدوال — علوم الحياة",
    daysFromNow(10),
    "/practice/take?bank=g12-ls-functions&mode=contest",
    now,
  );
  reminder.run(
    createId("ex"),
    ids.student,
    "grade-9",
    "Thales / Brevet geometry",
    "طاليس · هندسة الشهادة المتوسطة",
    daysFromNow(18),
    "/practice/take?bank=brevet-geometry&mode=contest",
    now,
  );
}

function seedDemoPromoCodes(db: DatabaseSync) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO promo_codes
      (code, scope_kind, scope_id, created_at, expires_at, batch_id, note, redeemed_by, redeemed_at, redeemed_name, redeemed_phone)
     VALUES (?, ?, ?, ?, NULL, 'demo-seed', ?, NULL, NULL, NULL, NULL)`,
  );
  const now = new Date().toISOString();
  for (const item of DEMO_PROMO_CODES) {
    insert.run(item.code, item.scopeKind, item.scopeId, now, item.note);
  }
}

function backfillDemoPhones(db: DatabaseSync) {
  const update = db.prepare("UPDATE users SET phone = ? WHERE email = ? AND (phone IS NULL OR phone = '')");
  for (const account of DEMO_ACCOUNTS) {
    if (account.phone) update.run(account.phone, account.email.toLowerCase());
  }
}

function toSessionUser(row: UserRow): SessionUser {
  const role: UserRole = isUserRole(row.role) ? row.role : "student";
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role,
    linkedStudentId: row.linked_student_id,
    track: row.track,
    phone: row.phone,
  };
}

export function findUserByEmail(email: string) {
  const row = openDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as UserRow | undefined;
  if (!row) return undefined;
  return { user: toSessionUser(row), passwordHash: row.password_hash };
}

export function findUserById(id: string) {
  const row = openDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toSessionUser(row) : undefined;
}

export function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  track?: string | null;
  phone?: string | null;
  linkedStudentEmail?: string | null;
}) {
  const db = openDb();
  const email = input.email.trim().toLowerCase();
  if (findUserByEmail(email)) {
    return { ok: false as const, error: "هذا البريد مسجّل مسبقاً" };
  }
  let linkedStudentId: string | null = null;
  if (input.role === "parent" && input.linkedStudentEmail) {
    const linked = findUserByEmail(input.linkedStudentEmail);
    if (!linked || linked.user.role !== "student") {
      return { ok: false as const, error: "لم نجد طالباً بهذا البريد لربطه" };
    }
    linkedStudentId = linked.user.id;
  }
  const id = createId(input.role);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, role, linked_student_id, track, phone, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    email,
    input.name.trim(),
    hashPassword(input.password),
    input.role,
    linkedStudentId,
    input.track ?? (input.role === "student" ? "grade-12" : null),
    input.phone?.replace(/\s+/g, "") || null,
    now,
  );
  if (input.role === "student") {
    const track = input.track || "grade-12";
    db.prepare(
      `INSERT INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(createId("enr"), id, track, 0, now);
    if (track === "grade-12") {
      db.prepare(
        `INSERT OR IGNORE INTO enrollments (id, user_id, track, progress, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(createId("enr"), id, "grade-9", 0, now);
    }
  }
  const user = findUserById(id);
  if (!user) return { ok: false as const, error: "تعذر إنشاء الحساب" };
  return { ok: true as const, user };
}

export function listEnrollments(userId: string) {
  return openDb()
    .prepare("SELECT id, user_id, track, progress FROM enrollments WHERE user_id = ?")
    .all(userId) as EnrollmentRow[];
}

export function listLessonProgress(userId: string) {
  return openDb()
    .prepare("SELECT lesson_id, percent, passed_quiz, completed_at FROM lesson_progress WHERE user_id = ?")
    .all(userId) as LessonProgressRow[];
}

export function listReminders(userId: string, track?: string | null) {
  const rows = openDb()
    .prepare(
      `SELECT id, user_id, track, title, arabic_title, due_at, href
       FROM exam_reminders
       WHERE user_id = ? OR user_id IS NULL
       ORDER BY due_at ASC`,
    )
    .all(userId) as ReminderRow[];
  if (!track) return rows;
  return rows.filter((row) => !row.track || row.track === track);
}

export function asProgressEntries(userId: string) {
  return listLessonProgress(userId).map((row) => ({
    lessonId: row.lesson_id,
    completedAt: row.completed_at ?? new Date().toISOString(),
    score: row.percent,
    passedQuiz: row.passed_quiz === 1,
  }));
}

export function updateUserProfile(id: string, patch: { name?: string; phone?: string | null }) {
  const current = findUserById(id);
  if (!current) return undefined;
  const name = patch.name?.trim() || current.name;
  const phone = patch.phone === undefined ? current.phone ?? null : patch.phone?.replace(/\s+/g, "") || null;
  openDb().prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, id);
  return findUserById(id);
}

export function listUsersByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  return unique.map((id) => findUserById(id)).filter((user): user is SessionUser => Boolean(user));
}
