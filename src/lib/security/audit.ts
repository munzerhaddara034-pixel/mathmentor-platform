/**
 * Append-only audit log for destructive and privileged actions.
 * Postgres: INSERT into mm_audit_log (migration 005; a trigger rejects UPDATE/DELETE).
 * Without DATABASE_URL: appended to the `audit-log.json` document store.
 * Every entry is also written as one structured log line, so it survives even if storage fails.
 */
import { updateJsonFile } from "@/lib/dataDir";
import { dbQuery, isPostgresEnabled } from "@/lib/db/pg";
import { buildAuditEntry, type AuditInput } from "./auditEntry";

export type { AuditEntry, AuditInput } from "./auditEntry";

const AUDIT_DOC = "audit-log.json";

export async function appendAuditLog(input: AuditInput): Promise<void> {
  const entry = buildAuditEntry(input);
  console.info(`[mathmentor][audit] ${JSON.stringify(entry)}`);
  if (isPostgresEnabled()) {
    await dbQuery(
      `INSERT INTO mm_audit_log (at, action, actor_id, actor_email, actor_role, target, ip, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [entry.at, entry.action, entry.actorId, entry.actorEmail, entry.actorRole, entry.target, entry.ip, JSON.stringify(entry.details)],
    );
    return;
  }
  await updateJsonFile<{ entries: typeof entry[] }>(AUDIT_DOC, { entries: [] }, (current) => ({
    entries: [...(Array.isArray(current?.entries) ? current.entries : []), entry],
  }));
}
