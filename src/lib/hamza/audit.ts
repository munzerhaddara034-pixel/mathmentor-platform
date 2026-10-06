/**
 * Writes Hamza events to the append-only mm_audit_log (file store without DATABASE_URL).
 * Never throws: an audit failure is logged loudly but must not leave a half-done GitHub action unrecorded
 * in the chat (the chat message + proposal timeline are the second trail).
 */
import { appendAuditLog } from "@/lib/security/audit";
import { hamzaAuditRecord, type HamzaAuditAction, type HamzaAuditActor, type HamzaAuditDetails } from "./auditEvents";

export type HamzaAuditFn = (
  action: HamzaAuditAction,
  input: { actor?: HamzaAuditActor | null; ip?: string | null; details?: HamzaAuditDetails },
) => Promise<void>;

export const hamzaAudit: HamzaAuditFn = async (action, input) => {
  const record = hamzaAuditRecord(action, input);
  try {
    await appendAuditLog(record);
  } catch (error) {
    console.error(`[mathmentor][hamza] audit write failed for ${action}:`, error instanceof Error ? error.message : error);
  }
};
