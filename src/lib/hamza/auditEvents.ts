/** Hamza audit vocabulary (pure; unit-tested). Every pipeline step writes one of these to mm_audit_log. */

export const HAMZA_AUDIT_ACTIONS = [
  "hamza.task.created",
  "hamza.task.cancelled",
  "hamza.task.failed",
  "hamza.proposal.created",
  "hamza.code.issued",
  "hamza.code.failed",
  "hamza.approve.pr",
  "hamza.pr.opened",
  "hamza.pr.updated",
  "hamza.ci.result",
  "hamza.repair.requested",
  "hamza.approve.merge",
  "hamza.merged",
  "hamza.merge.failed",
  "hamza.revert.requested",
  "hamza.revert.merged",
  "hamza.rejected",
  "hamza.budget.stop",
  "hamza.budget.raised",
] as const;

export type HamzaAuditAction = (typeof HAMZA_AUDIT_ACTIONS)[number];

export type HamzaAuditActor = { id?: string | null; email?: string | null; role?: string | null; name?: string | null };

/** Details recorded on every Hamza audit entry (plan §4.9). Unknown/empty fields are dropped. */
export type HamzaAuditDetails = {
  proposalId?: string;
  taskId?: string;
  revision?: number;
  diffHash?: string;
  branch?: string;
  baseBranch?: string;
  sha?: string;
  prNumber?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  usd?: number;
  reason?: string;
  result?: string;
  actorName?: string;
};

export type HamzaAuditRecord = {
  action: HamzaAuditAction;
  actor: { id: string | null; email: string | null; role: string | null } | null;
  target: string | null;
  ip: string | null;
  details: Record<string, string | number | boolean>;
};

export function isHamzaAuditAction(value: string): value is HamzaAuditAction {
  return (HAMZA_AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function hamzaAuditRecord(
  action: HamzaAuditAction,
  input: { actor?: HamzaAuditActor | null; ip?: string | null; details?: HamzaAuditDetails },
): HamzaAuditRecord {
  const details: Record<string, string | number | boolean> = {};
  const merged: HamzaAuditDetails = { ...input.details, actorName: input.details?.actorName ?? input.actor?.name ?? undefined };
  for (const [key, value] of Object.entries(merged)) {
    if (typeof value === "string" && value) details[key] = value.slice(0, 300);
    else if (typeof value === "number" && Number.isFinite(value)) details[key] = value;
    else if (typeof value === "boolean") details[key] = value;
  }
  return {
    action,
    actor: input.actor ? { id: input.actor.id ?? null, email: input.actor.email ?? null, role: input.actor.role ?? null } : null,
    target: input.details?.proposalId ?? input.details?.taskId ?? null,
    ip: input.ip ?? null,
    details,
  };
}
