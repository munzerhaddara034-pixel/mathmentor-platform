/** «Ask Hamza to change…»: queue a revision task on the same proposal (same branch/PR, revision + 1). */
import { createId } from "@/lib/ids";
import { redactSecrets } from "@/lib/team/secrets";
import type { TeamRepo } from "@/lib/team/repo";
import type { TeamMessage, TeamProposal } from "@/lib/team/types";
import { hamzaMessage } from "./runner/messages";
import { REVISABLE_STATUSES } from "./runner/proposalFromDraft";
import { enqueueHamzaTask, type TaskActor, type TaskDeps } from "./tasks/enqueue";
import type { HamzaTask } from "./tasks/types";

export type ReviseResult =
  | { ok: true; proposal: TeamProposal; message: TeamMessage; task: HamzaTask }
  | { ok: false; status: number; error: string; errorAr: string };

export async function requestRevision(deps: TaskDeps & { repo: TeamRepo }, input: { proposalId: string; text: string; actor: TaskActor }): Promise<ReviseResult> {
  const text = redactSecrets(input.text.trim().slice(0, 2000)).text;
  if (text.length < 3) return { ok: false, status: 400, error: "Describe the change.", errorAr: "اكتب التعديل المطلوب." };
  const proposal = await deps.repo.getProposal(input.proposalId);
  if (!proposal) return { ok: false, status: 404, error: "Proposal not found.", errorAr: "الاقتراح غير موجود." };
  if (!REVISABLE_STATUSES.includes(proposal.status)) {
    return { ok: false, status: 409, error: "This proposal can no longer be revised.", errorAr: "لم يعد ممكناً تعديل هذا الاقتراح." };
  }
  const now = deps.now();
  const human: TeamMessage = {
    id: createId("tmsg"),
    channel: proposal.channel,
    authorKind: "human",
    authorId: input.actor.id,
    authorName: input.actor.name,
    text: `✏️ تعديل على «${proposal.commitMessage}»: ${text}`,
    attachments: [],
    createdAt: now.toISOString(),
    proposalId: proposal.id,
  };
  await deps.repo.addMessage(human);
  const queued = await enqueueHamzaTask(deps, {
    channel: proposal.channel,
    kind: "revision",
    proposalId: proposal.id,
    requestText: text,
    actor: input.actor,
    turns: [{ role: "user", text }],
    replyToId: human.id,
  });
  if (!queued.ok) return { ok: false, status: queued.reason === "busy" ? 409 : 403, error: queued.reason, errorAr: queued.text };
  const message = hamzaMessage(queued.task, queued.text, now, { proposalId: proposal.id });
  await deps.repo.addMessage(message);
  return { ok: true, proposal, message, task: queued.task };
}
