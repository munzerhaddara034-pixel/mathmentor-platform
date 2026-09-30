/** Pure audit-entry shaping (unit-tested). Details are size-capped and never carry secrets. */

export type AuditInput = {
  action: string;
  actor?: { id?: string | null; email?: string | null; role?: string | null } | null;
  target?: string | null;
  ip?: string | null;
  details?: Record<string, unknown>;
  now?: Date;
};

export type AuditEntry = {
  at: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  target: string | null;
  ip: string | null;
  details: Record<string, unknown>;
};

const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|authorization|cookie/i;
const MAX_DETAILS_CHARS = 4000;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrub(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : scrub(item, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") return value.slice(0, 500);
  return value;
}

export function buildAuditEntry(input: AuditInput): AuditEntry {
  let details = (scrub(input.details ?? {}) as Record<string, unknown>) ?? {};
  if (JSON.stringify(details).length > MAX_DETAILS_CHARS) details = { truncated: true };
  return {
    at: (input.now ?? new Date()).toISOString(),
    action: input.action.slice(0, 120),
    actorId: input.actor?.id ?? null,
    actorEmail: input.actor?.email ?? null,
    actorRole: input.actor?.role ?? null,
    target: input.target?.slice(0, 300) ?? null,
    ip: input.ip?.slice(0, 64) ?? null,
    details,
  };
}
