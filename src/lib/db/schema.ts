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
  {
    id: "007_payments",
    description: "Manual payment claims (Whish / OMT, USD) reviewed by the admin + receipt images (bytea)",
    sql: `
      CREATE TABLE IF NOT EXISTS mm_payments (
        id                  TEXT PRIMARY KEY,
        user_id             TEXT NOT NULL,
        payer_name          TEXT NOT NULL CHECK (char_length(btrim(payer_name)) BETWEEN 2 AND 120),
        payer_email         TEXT CHECK (payer_email IS NULL OR (char_length(payer_email) <= 254 AND payer_email LIKE '%_@_%')),
        payer_phone         TEXT CHECK (payer_phone IS NULL OR payer_phone ~ '^\\+[0-9]{8,15}$'),
        plan                TEXT NOT NULL CHECK (char_length(plan) BETWEEN 1 AND 40),
        period              TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'term')),
        pricing_region      TEXT CHECK (pricing_region IN ('lebanon', 'gcc', 'international', 'admissions_us')),
        expected_amount_usd NUMERIC(12,2) NOT NULL CHECK (expected_amount_usd > 0),
        amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        currency            TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
        method              TEXT NOT NULL CHECK (method IN ('whish', 'omt')),
        reference           TEXT NOT NULL CHECK (reference ~ '^[A-Z0-9][A-Z0-9._/-]{2,63}$'),
        reference_raw       TEXT NOT NULL CHECK (char_length(reference_raw) <= 100),
        transfer_date       DATE NOT NULL,
        receipt_url         TEXT,
        order_id            TEXT,
        status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
        submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        reviewed_at         TIMESTAMPTZ,
        reviewed_by         TEXT,
        note                TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
        period_start        TIMESTAMPTZ,
        period_end          TIMESTAMPTZ,
        owner_notified_at   TIMESTAMPTZ,
        student_notified_at TIMESTAMPTZ,
        CONSTRAINT mm_payments_contact_chk CHECK (payer_email IS NOT NULL OR payer_phone IS NOT NULL),
        CONSTRAINT mm_payments_review_chk CHECK (
          (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
          (status <> 'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)),
        CONSTRAINT mm_payments_confirmed_chk CHECK (status <> 'confirmed' OR (period_start IS NOT NULL AND period_end > period_start)),
        CONSTRAINT mm_payments_rejected_chk CHECK (status <> 'rejected' OR (note IS NOT NULL AND btrim(note) <> ''))
      );
      -- A reference can be claimed again only after the earlier claim was rejected ("not received").
      CREATE UNIQUE INDEX IF NOT EXISTS mm_payments_method_reference_active
        ON mm_payments (method, reference) WHERE status IN ('pending', 'confirmed');
      -- One open claim per student and plan (double clicks / spam); another plan is still allowed.
      CREATE UNIQUE INDEX IF NOT EXISTS mm_payments_one_pending_per_plan
        ON mm_payments (user_id, plan) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS mm_payments_pending_idx ON mm_payments (submitted_at) WHERE status = 'pending';
      CREATE INDEX IF NOT EXISTS mm_payments_user_idx ON mm_payments (user_id, submitted_at DESC);
      CREATE INDEX IF NOT EXISTS mm_payments_reviewed_idx ON mm_payments (status, reviewed_at DESC);
      CREATE INDEX IF NOT EXISTS mm_payments_period_end_idx ON mm_payments (period_end) WHERE status = 'confirmed';

      CREATE TABLE IF NOT EXISTS mm_payment_receipts (
        payment_id TEXT PRIMARY KEY REFERENCES mm_payments (id) ON DELETE CASCADE,
        mime_type  TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
        size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
        sha256     TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
        bytes      BYTEA,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        purged_at  TIMESTAMPTZ,
        CONSTRAINT mm_payment_receipts_bytes_chk CHECK ((bytes IS NULL) = (purged_at IS NOT NULL))
      );
      CREATE INDEX IF NOT EXISTS mm_payment_receipts_sha_idx ON mm_payment_receipts (sha256);
    `,
  },
  {
    id: "008_finance_views",
    description: "Read-only finance view (paid / overdue / expiring) + grants for the optional mm_finance_ro role",
    sql: `
      CREATE OR REPLACE VIEW mm_finance_subscriptions AS
      WITH u AS (
        SELECT x->>'id' AS user_id,
               x->>'name' AS name,
               lower(x->>'email') AS email,
               NULLIF(btrim(x->>'phone'), '') AS phone,
               x->>'subscriptionType' AS subscription_type,
               x->>'entitlementPlanId' AS plan,
               CASE WHEN x->>'aiExpiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN (x->>'aiExpiresAt')::timestamptz END AS ai_expires_at,
               CASE WHEN x->>'liveCredits' ~ '^[0-9]+(\\.[0-9]+)?$' THEN floor((x->>'liveCredits')::numeric)::int ELSE 0 END AS live_credits
        FROM mm_documents d
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(d.data->'users') = 'array' THEN d.data->'users' ELSE '[]'::jsonb END) AS x
        WHERE d.key = 'auth.json' AND x->>'role' = 'student'
      ), p AS (
        SELECT user_id,
               max(period_end) FILTER (WHERE status = 'confirmed') AS paid_until,
               max(reviewed_at) FILTER (WHERE status = 'confirmed') AS last_paid_at,
               count(*) FILTER (WHERE status = 'pending') AS pending_count,
               sum(amount) FILTER (WHERE status = 'confirmed') AS lifetime_paid_usd
        FROM mm_payments
        GROUP BY user_id
      )
      SELECT u.user_id, u.name, u.email, u.phone, u.subscription_type, u.plan, u.ai_expires_at, u.live_credits,
             p.paid_until, p.last_paid_at, COALESCE(p.pending_count, 0) AS pending_count,
             COALESCE(p.lifetime_paid_usd, 0) AS lifetime_paid_usd,
             GREATEST(u.ai_expires_at, p.paid_until) AS expires_at,
             CASE
               WHEN GREATEST(u.ai_expires_at, p.paid_until) IS NULL THEN 'never_paid'
               WHEN GREATEST(u.ai_expires_at, p.paid_until) < now() THEN 'overdue'
               WHEN GREATEST(u.ai_expires_at, p.paid_until) < now() + interval '7 days' THEN 'expiring_soon'
               ELSE 'active'
             END AS finance_status
      FROM u
      LEFT JOIN p USING (user_id);

      DO $grant$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mm_finance_ro') THEN
          GRANT USAGE ON SCHEMA public TO mm_finance_ro;
          GRANT SELECT ON mm_payments, mm_finance_subscriptions TO mm_finance_ro;
        END IF;
      END
      $grant$;
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
