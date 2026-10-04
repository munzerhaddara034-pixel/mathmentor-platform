/**
 * Append-only audit log for destructive and privileged actions.
 * Postgres: INSERT into mm_audit_log (migration 005; a trigger rejects UPDATE/DELETE).
 * Without DATABASE_URL: appended to the `audit-log.json` document store.
 * Every entry is also written as one structured log line, so it survives even if storage fails.
 */
import { currentDocumentTransaction, updateJsonFile } from "@/lib/dataDir";
import { dbQuery, isPostgresEnabled } from "@/lib/db/pg";
import { buildAuditEntry, type AuditInput } from "./auditEntry";

export type { AuditEntry, AuditInput } from "./auditEntry";

/** Anything with pg's `query(sql, params)` — a Pool or a PoolClient inside a transaction. */
export type AuditQueryable = { query: (sql: string, params?: unknown[]) => Promise<unknown> };

const AUDIT_INSERT_SQL = `INSERT INTO mm_audit_log (at, action, actor_id, actor_email, actor_role, target, ip, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`;

/**
 * Same entry as appendAuditLog, written through the caller's transaction client so the audit row
 * commits (or rolls back) together with the change it describes. Postgres only.
 */
export async function appendAuditLogTx(client: AuditQueryable, input: AuditInput): Promise<void> {
  const entry = buildAuditEntry(input);
  console.info(`[mathmentor][audit] ${JSON.stringify(entry)}`);
  await client.query(AUDIT_INSERT_SQL, [
    entry.at,
    entry.action,
    entry.actorId,
    entry.actorEmail,
    entry.actorRole,
    entry.target,
    entry.ip,
    JSON.stringify(entry.details),
  ]);
}

const AUDIT_DOC = "audit-log.json";

export async function appendAuditLog(input: AuditInput): Promise<void> {
  const entry = buildAuditEntry(input);
  console.info(`[mathmentor][audit] ${JSON.stringify(entry)}`);
  if (isPostgresEnabled()) {
    await dbQuery(
      AUDIT_INSERT_SQL,
      [entry.at, entry.action, entry.actorId, entry.actorEmail, entry.actorRole, entry.target, entry.ip, JSON.stringify(entry.details)],
    );
    return;
  }
  await updateJsonFile<{ entries: typeof entry[] }>(AUDIT_DOC, { entries: [] }, (current) => ({
    entries: [...(Array.isArray(current?.entries) ? current.entries : []), entry],
  }));
}

/**
 * Audit from inside a withDocumentLock scope: on Postgres the row is written on the scope's
 * transaction (it commits or rolls back with the change it describes); otherwise appendAuditLog.
 */
export async function appendAuditLogLocked(input: AuditInput): Promise<void> {
  const client = currentDocumentTransaction();
  if (client) return appendAuditLogTx(client, input);
  return appendAuditLog(input);
}
