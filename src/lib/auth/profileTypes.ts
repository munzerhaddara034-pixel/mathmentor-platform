/** Row shapes + repository contract for the role-dashboard profile store (SQLite or Postgres). */

export type ProfileUserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  linked_student_id: string | null;
  track: string | null;
  created_at: string;
};

export type EnrollmentRow = {
  id: string;
  user_id: string;
  track: string;
  progress: number;
};

export type EnrollmentInsert = EnrollmentRow & { created_at: string };

export type LessonProgressRow = {
  lesson_id: string;
  percent: number;
  passed_quiz: number;
  completed_at: string | null;
};

export type LessonProgressInsert = LessonProgressRow & { id: string; user_id: string };

export type ReminderRow = {
  id: string;
  user_id: string | null;
  track: string | null;
  title: string;
  arabic_title: string;
  due_at: string;
  href: string | null;
};

export type ReminderInsert = ReminderRow & { created_at: string };

export interface ProfileRepo {
  findUserByEmail(email: string): Promise<ProfileUserRow | undefined>;
  findUserById(id: string): Promise<ProfileUserRow | undefined>;
  insertUser(row: ProfileUserRow): Promise<void>;
  /** `ignoreConflict` = INSERT OR IGNORE / ON CONFLICT DO NOTHING on (user_id, track). */
  insertEnrollment(row: EnrollmentInsert, ignoreConflict: boolean): Promise<void>;
  listEnrollments(userId: string): Promise<EnrollmentRow[]>;
  listLessonProgress(userId: string): Promise<LessonProgressRow[]>;
  listReminders(userId: string): Promise<ReminderRow[]>;
  /** UI locale saved on the profile row (null when unset or no row). */
  getLocaleByEmail(email: string): Promise<string | null>;
  /** Returns false when no profile row exists for that email (nothing written). */
  setLocaleByEmail(email: string, locale: string): Promise<boolean>;
}
