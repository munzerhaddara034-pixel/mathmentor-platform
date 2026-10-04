/** Hamza activity & cost view: recent hamza.* audit entries + task costs for the Beirut month (pure summary + readers). */
import { readJsonFile } from "@/lib/dataDir";
import { dbQuery, isPostgresEnabled } from "@/lib/db/pg";
import type { HamzaActivity, HamzaActivityEvent } from "./activityTypes";
import type { PublicHamzaTask } from "./tasks/types";

export type { HamzaActivity, HamzaActivityEvent } from "./activityTypes";

export function summarizeActivity(input: {
  monthKey: string;
  monthStartIso: string;
  tasks: PublicHamzaTask[];
  events: HamzaActivityEvent[];
  caps: { monthCapUsd: number; taskCapUsd: number; taskMaxUsd: number };
}): HamzaActivity {
  const monthTasks = input.tasks.filter((task) => task.createdAt >= input.monthStartIso);
  const monthEvents = input.events.filter((event) => event.at >= input.monthStartIso);
  const count = (action: string) => monthEvents.filter((event) => event.action === action).length;
  const models = new Map<string, number>();
  for (const task of monthTasks) {
    const share = task.cost.models.length ? task.cost.usd / task.cost.models.length : 0;
    for (const model of task.cost.models) models.set(model, (models.get(model) ?? 0) + share);
  }
  return {
    monthKey: input.monthKey,
    monthUsd: Math.round(monthTasks.reduce((sum, task) => sum + task.cost.usd, 0) * 10_000) / 10_000,
    monthCapUsd: input.caps.monthCapUsd,
    taskCapUsd: input.caps.taskCapUsd,
    taskMaxUsd: input.caps.taskMaxUsd,
    counts: {
      tasks: monthTasks.length,
      proposals: count("hamza.proposal.created"),
      prs: count("hamza.pr.opened"),
      merged: count("hamza.merged"),
      ciFailed: monthEvents.filter((event) => event.action === "hamza.ci.result" && event.details.result === "failed").length,
      reverts: count("hamza.revert.requested"),
    },
    byModel: [...models.entries()].map(([model, usd]) => ({ model, usd: Math.round(usd * 10_000) / 10_000 })).sort((a, b) => b.usd - a.usd),
    tasks: [...input.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
    events: input.events.slice(0, 50),
  };
}

type AuditRow = { at: string | Date; action: string; target: string | null; actor_email: string | null; details: Record<string, unknown> };
type FileEntry = { at: string; action: string; target: string | null; actorEmail: string | null; details: Record<string, unknown> };

/** Newest first. Read-only (the audit log is append-only). */
export async function readHamzaAudit(limit = 200): Promise<HamzaActivityEvent[]> {
  if (isPostgresEnabled()) {
    const rows = await dbQuery<AuditRow>(
      `SELECT at, action, target, actor_email, details FROM mm_audit_log WHERE action LIKE 'hamza.%' ORDER BY at DESC LIMIT $1`,
      [limit],
    );
    return rows.map((row) => ({ at: new Date(row.at).toISOString(), action: row.action, target: row.target, actorEmail: row.actor_email, details: row.details ?? {} }));
  }
  const doc = await readJsonFile<{ entries?: FileEntry[] }>("audit-log.json", { entries: [] });
  return (Array.isArray(doc.entries) ? doc.entries : [])
    .filter((entry) => typeof entry.action === "string" && entry.action.startsWith("hamza."))
    .slice(-limit)
    .reverse()
    .map((entry) => ({ at: entry.at, action: entry.action, target: entry.target ?? null, actorEmail: entry.actorEmail ?? null, details: entry.details ?? {} }));
}
