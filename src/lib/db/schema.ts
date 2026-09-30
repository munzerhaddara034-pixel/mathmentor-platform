/**
 * Idempotent Postgres schema for MathMentor (Neon free tier friendly).
 *
 * Dependency-free on purpose: `scripts/db-migrate.mjs` imports this file directly
 * (Node 22 type stripping), and the server runs the same list on startup.
 * Every statement is `IF NOT EXISTS`, so re-running is always safe.
 */

export type SchemaMigration = {
  id: string;
  description: string;
  sql: string;
};

export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    id: "001_documents",
    description: "Generic JSON document store backing every data/*.json store (auth, bookings, notifications, agent hub…)",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_documents (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `,
  },
  {
    id: "002_profiles",
    description: "Role-dashboard profile tables (previously SQLite data/auth.db)",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_profile_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        linked_student_id TEXT,
        track TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mm_enrollments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        track TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE (user_id, track)
      );
      CREATE TABLE IF NOT EXISTS mm_lesson_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        percent INTEGER NOT NULL DEFAULT 0,
        passed_quiz INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        UNIQUE (user_id, lesson_id)
      );
      CREATE TABLE IF NOT EXISTS mm_exam_reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        track TEXT,
        title TEXT NOT NULL,
        arabic_title TEXT NOT NULL,
        due_at TEXT NOT NULL,
        href TEXT,
        created_at TEXT NOT NULL
      );
    `,
  },
  {
    id: "003_ai_queries",
    description: "AI solver query log + teacher audit status",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_ai_queries (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        audit_status TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS mm_ai_queries_created_idx ON mm_ai_queries (created_at DESC);
      CREATE INDEX IF NOT EXISTS mm_ai_queries_user_idx ON mm_ai_queries (user_id, created_at DESC);
    `,
  },
  {
    id: "004_team_chat",
    description: "In-platform team chat (/admin/team): messages, attachments, developer proposals",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_team_messages (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS mm_team_messages_channel_idx ON mm_team_messages (channel, created_at DESC);
      CREATE TABLE IF NOT EXISTS mm_team_attachments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        bytes BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS mm_team_proposals (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        data JSONB NOT NULL
      );
    `,
  },
  {
    id: "005_audit_log",
    description: "Append-only audit log for destructive / admin actions (UPDATE and DELETE are rejected by trigger)",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_audit_log (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        action TEXT NOT NULL,
        actor_id TEXT,
        actor_email TEXT,
        actor_role TEXT,
        target TEXT,
        ip TEXT,
        details JSONB NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE INDEX IF NOT EXISTS mm_audit_log_at_idx ON mm_audit_log (at DESC);
      CREATE OR REPLACE FUNCTION mm_audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        RAISE EXCEPTION 'mm_audit_log is append-only';
      END;
      $fn$;
      CREATE OR REPLACE TRIGGER mm_audit_log_no_update_delete
        BEFORE UPDATE OR DELETE ON mm_audit_log
        FOR EACH ROW EXECUTE FUNCTION mm_audit_log_append_only();
    `,
  },
  {
    id: "006_profile_locale",
    description: "UI locale (en / ar / fr) on profile users — redesign-v2 global platform",
    sql: `
      ALTER TABLE mm_profile_users ADD COLUMN IF NOT EXISTS locale TEXT;
    `,
  },
];

export const MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS mm_schema_migrations (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/** Arbitrary constant for pg_advisory_lock so concurrent boots never race the DDL. */
export const MIGRATION_LOCK_KEY = 72_026_930;
