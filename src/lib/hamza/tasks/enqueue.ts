/** Creating, cancelling and continuing Hamza tasks (chat side; the worker runs them). */
import { createId } from "@/lib/ids";
import type { TeamChannelId } from "@/lib/team/types";
import type { HamzaAuditFn } from "../audit";
import type { HamzaConfig } from "../config";
import { beirutMonth, emptyCost, estimateFor } from "../cost";
import type { RouterTurn } from "../models/providers";
import { usd } from "../runner/messages";
import { ACTIVE_TASK_STATUSES, type HamzaTask, type HamzaTaskKind, type HamzaTaskRepo } from "./types";

export type TaskDeps = { tasks: HamzaTaskRepo; config: HamzaConfig; audit: HamzaAuditFn; now: () => Date };
export type TaskActor = { id: string; name: string; email: string; role: string; ip?: string };

export type EnqueueInput = {
  channel: TeamChannelId;
  kind: HamzaTaskKind;
  requestText: string;
  actor: TaskActor;
  turns: RouterTurn[];
  replyToId?: string;
  proposalId?: string;
  extraContext?: string;
};

export type EnqueueResult =
  | { ok: true; task: HamzaTask; text: string }
  | { ok: false; reason: "disabled" | "busy" | "month_budget"; text: string; task?: HamzaTask };

export async function enqueueHamzaTask(deps: TaskDeps, input: EnqueueInput): Promise<EnqueueResult> {
  const { config } = deps;
  if (!config.enabled) return { ok: false, reason: "disabled", text: "حمزة متوقف أو غير مُعدّ على هذا الخادم (HAMZA_ENABLED أو إعدادات ناقصة — docs/HAMZA.md). لم تُنشأ أي مهمة." };
  const busy = (await deps.tasks.listActive()).find((task) => task.channel === input.channel);
  if (busy) {
    return { ok: false, reason: "busy", task: busy, text: `عندي مهمة قيد التنفيذ في هذه القناة («${busy.requestText.slice(0, 60)}»). انتظرها أو ألغِها من بطاقتها ثم أعد الطلب.` };
  }
  const now = deps.now();
  const spent = await deps.tasks.monthSpentUsd(beirutMonth(now).startIso);
  if (spent >= config.budgets.monthlyUsd) {
    await deps.audit("hamza.budget.stop", { actor: input.actor, ip: input.actor.ip, details: { usd: spent, reason: "month_budget" } });
    return { ok: false, reason: "month_budget", text: `وصل إنفاق حمزة هذا الشهر إلى ${usd(spent)} (الحد ${usd(config.budgets.monthlyUsd)}). لن أبدأ مهام جديدة حتى بداية الشهر أو رفع HAMZA_MONTHLY_BUDGET_USD.` };
  }
  const estimateUsd = estimateFor(input.requestText);
  const at = now.toISOString();
  const task: HamzaTask = {
    id: createId("htask"),
    channel: input.channel,
    kind: input.kind,
    status: "queued",
    requestText: input.requestText.slice(0, 4000),
    requestedBy: input.actor.name,
    requestedById: input.actor.id,
    replyToId: input.replyToId,
    proposalId: input.proposalId,
    turns: input.turns.slice(-16),
    extraContext: input.extraContext,
    cost: emptyCost(estimateUsd),
    capUsd: config.budgets.taskUsd,
    estimateUsd,
    progress: { steps: 0, toolCalls: 0 },
    attempt: 0,
    createdAt: at,
    updatedAt: at,
  };
  await deps.tasks.create(task);
  await deps.audit("hamza.task.created", { actor: input.actor, ip: input.actor.ip, details: { taskId: task.id, proposalId: input.proposalId, reason: input.kind, usd: estimateUsd } });
  const what = input.kind === "new" ? "أستكشف المستودع ثم أقترح Diff" : input.kind === "repair" ? "أصلح سبب فشل CI على نفس الـ PR" : "أعدّل نفس الاقتراح (نسخة جديدة)";
  return { ok: true, task, text: `⏳ بدأت العمل في الخلفية: ${what}. التقدير ~${usd(estimateUsd)} · الحد ${usd(task.capUsd)}. التقدم والإلغاء من بطاقة المهمة.` };
}

export async function cancelHamzaTask(deps: TaskDeps, taskId: string, actor: TaskActor): Promise<HamzaTask | undefined> {
  const at = deps.now().toISOString();
  const stopped =
    (await deps.tasks.update(taskId, ["queued", "budget_paused"], { status: "cancelled", finishedAt: at, result: { kind: "cancelled", message: `Cancelled by ${actor.name}` } })) ??
    (await deps.tasks.update(taskId, ["running"], { cancelRequested: true }));
  if (stopped) await deps.audit("hamza.task.cancelled", { actor, ip: actor.ip, details: { taskId, result: stopped.status } });
  return stopped;
}

/** «Continue up to $5»: a budget-paused task goes back to the queue with the raised cap. */
export async function continueHamzaTask(deps: TaskDeps, taskId: string, actor: TaskActor): Promise<HamzaTask | undefined> {
  if (!deps.config.enabled) return undefined;
  const task = await deps.tasks.get(taskId);
  if (!task || task.status !== "budget_paused" || task.pauseReason !== "task_budget") return undefined;
  if (task.capUsd >= deps.config.budgets.taskMaxUsd) return undefined;
  const raised = await deps.tasks.update(taskId, ["budget_paused"], { status: "queued", capUsd: deps.config.budgets.taskMaxUsd, attempt: 0, pauseReason: undefined });
  if (raised) await deps.audit("hamza.budget.raised", { actor, ip: actor.ip, details: { taskId, usd: deps.config.budgets.taskMaxUsd } });
  return raised;
}

export function isActiveTask(task: HamzaTask): boolean {
  return ACTIVE_TASK_STATUSES.includes(task.status);
}
