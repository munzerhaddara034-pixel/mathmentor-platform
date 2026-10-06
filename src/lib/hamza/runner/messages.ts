/** Chat messages written by the runner (author «حمزة»). */
import { createId } from "@/lib/ids";
import type { TeamMessage } from "@/lib/team/types";
import type { HamzaTask } from "../tasks/types";

export function hamzaMessage(task: HamzaTask, text: string, now: Date, extra: Partial<TeamMessage> = {}): TeamMessage {
  return {
    id: createId("tmsg"),
    channel: task.channel,
    authorKind: "agent",
    authorId: "developer",
    authorName: "حمزة",
    text,
    attachments: [],
    createdAt: now.toISOString(),
    replyToId: task.replyToId,
    taskId: task.id,
    ...extra,
  };
}

export function usd(value: number): string {
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

export function proposalText(input: { replyAr: string; branch: string; base: string; files: Array<{ path: string; additions: number; deletions: number }>; cost: number; revision?: number }): string {
  const list = input.files
    .slice(0, 12)
    .map((file) => `${file.path} (+${file.additions}/−${file.deletions})`)
    .join("، ");
  return [
    input.replyAr || "جهّزت التعديل التالي للمراجعة.",
    "",
    `${input.revision ? `نسخة ${input.revision} · ` : ""}الفرع: ${input.branch} (→ ${input.base}) · الملفات: ${list}`,
    `الكلفة: ${usd(input.cost)}. لا PR قبل الموافقة #1 (رمز)، ولا دمج قبل نجاح CI والموافقة #2.`,
  ].join("\n");
}
