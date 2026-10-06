/** Team-chat thread state helpers (pure). */
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import type { TeamMessage, TeamProposal, TeamThreadResponse } from "@/lib/team/types";

export type Thread = { messages: TeamMessage[]; proposals: Record<string, TeamProposal>; tasks: Record<string, PublicHamzaTask>; loaded: boolean };

export const EMPTY_THREAD: Thread = { messages: [], proposals: {}, tasks: {}, loaded: false };

export function indexById<T extends { id: string }>(list: T[]): Record<string, T> {
  return Object.fromEntries(list.map((item) => [item.id, item]));
}

export function threadFrom(data: TeamThreadResponse): Thread {
  return { messages: data.messages, proposals: indexById(data.proposals), tasks: indexById(data.tasks ?? []), loaded: true };
}

const ACTIVE = ["queued", "running", "budget_paused"];

/** Polling is needed while Hamza works in the background (tasks queued/running). */
export function hasActiveWork(thread: Thread): boolean {
  return Object.values(thread.tasks).some((task) => ACTIVE.includes(task.status) && task.status !== "budget_paused");
}

/** The TaskCard renders under the FIRST message of each task (the «queued» reply). */
export function taskCardOwners(messages: TeamMessage[]): Map<string, string> {
  const owners = new Map<string, string>();
  for (const message of messages) if (message.taskId && !owners.has(message.taskId)) owners.set(message.taskId, message.id);
  return owners;
}
