/**
 * CI repair loop: when `hamza-ci` turns red on a Hamza PR, queue a repair task on the SAME proposal/PR
 * (≤ HAMZA_MAX_REPAIR_ROUNDS, max 2). Each repaired revision still needs Approval #1 before it is pushed.
 */
import type { TeamProposal } from "@/lib/team/types";
import { setCiFailedHandler } from "./pipeline/deps";
import { enqueueHamzaTask, type TaskDeps } from "./tasks/enqueue";
import { taskDeps } from "./tasks/deps";

export async function queueRepair(deps: TaskDeps, proposal: TeamProposal): Promise<string | undefined> {
  const rounds = proposal.hamza?.repairRounds ?? 0;
  const max = deps.config.maxRepairRounds;
  if (rounds >= max) return `وصلت محاولات الإصلاح التلقائي إلى الحد (${max}). راجع السجل أو اطلب من حمزة تعديلاً محدداً.`;
  const result = await enqueueHamzaTask(deps, {
    channel: proposal.channel,
    kind: "repair",
    proposalId: proposal.id,
    requestText: `CI repair for ${proposal.commitMessage}`,
    actor: { id: "hamza-ci", name: "hamza-ci", email: "", role: "system" },
    turns: [{ role: "user", text: `أصلح فشل CI على PR #${proposal.hamza?.prNumber ?? "?"} (${proposal.commitMessage}).` }],
  });
  if (!result.ok) return `لم أبدأ الإصلاح التلقائي: ${result.text}`;
  await deps.audit("hamza.repair.requested", { details: { proposalId: proposal.id, taskId: result.task.id, revision: proposal.hamza?.revision, prNumber: proposal.hamza?.prNumber } });
  return `🔧 بدأت محاولة الإصلاح ${rounds + 1}/${max} على نفس الـ PR. النسخة المصلَّحة تحتاج الموافقة #1 من جديد قبل رفعها.`;
}

export function registerRepairHandler(): void {
  setCiFailedHandler((proposal) => queueRepair(taskDeps(), proposal));
}
