/** Task-store logic over a plain object: shared by the JSON-file repo and the in-memory repo (tests). */
import type { AgentStepRecord } from "../agent/types";
import { MAX_TASK_ATTEMPTS, type HamzaTask, type HamzaTaskPatch, type HamzaTaskRepo, type HamzaTaskStatus } from "./types";

export type TaskStore = { tasks: HamzaTask[]; steps: Record<string, AgentStepRecord[]> };

const MAX_TASKS = 500;
const MAX_STEPS_PER_TASK = 200;
const ACTIVE: HamzaTaskStatus[] = ["queued", "running", "budget_paused"];

export function emptyTaskStore(): TaskStore {
  return { tasks: [], steps: {} };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function claimIn(store: TaskStore, workerId: string, now: Date, leaseMs: number): HamzaTask | undefined {
  const nowIso = now.toISOString();
  const candidates = store.tasks
    .filter((task) => task.status === "queued" || (task.status === "running" && (task.lockedUntil ?? "") < nowIso))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const task of candidates) {
    const stale = task.status === "running";
    if (stale && task.attempt >= MAX_TASK_ATTEMPTS) {
      Object.assign(task, { status: "failed", finishedAt: nowIso, updatedAt: nowIso, result: { kind: "failed", message: "Worker stopped twice while running this task." } });
      continue;
    }
    Object.assign(task, {
      status: "running",
      attempt: task.attempt + 1,
      lockedBy: workerId,
      lockedUntil: new Date(now.getTime() + leaseMs).toISOString(),
      startedAt: task.startedAt ?? nowIso,
      updatedAt: nowIso,
    });
    return clone(task);
  }
  return undefined;
}

export function updateIn(store: TaskStore, id: string, from: HamzaTaskStatus[] | null, patch: HamzaTaskPatch): HamzaTask | undefined {
  const task = store.tasks.find((item) => item.id === id);
  if (!task || (from && !from.includes(task.status))) return undefined;
  Object.assign(task, clone(patch), { updatedAt: new Date().toISOString() });
  return clone(task);
}

export function createIn(store: TaskStore, task: HamzaTask): void {
  store.tasks.push(clone(task));
  if (store.tasks.length > MAX_TASKS) {
    const drop = store.tasks.filter((item) => !ACTIVE.includes(item.status)).slice(0, store.tasks.length - MAX_TASKS);
    for (const old of drop) delete store.steps[old.id];
    store.tasks = store.tasks.filter((item) => !drop.includes(item));
  }
}

export function addStepIn(store: TaskStore, taskId: string, step: AgentStepRecord): void {
  const list = (store.steps[taskId] ??= []);
  list.push(clone(step));
  if (list.length > MAX_STEPS_PER_TASK) list.splice(0, list.length - MAX_STEPS_PER_TASK);
}

export function monthSpentIn(store: TaskStore, sinceIso: string): number {
  return store.tasks.filter((task) => task.createdAt >= sinceIso).reduce((sum, task) => sum + task.cost.usd, 0);
}

/** A HamzaTaskRepo over any (read, mutate) pair. */
export function engineRepo(kind: "file" | "memory", read: () => Promise<TaskStore>, mutate: <T>(fn: (store: TaskStore) => T) => Promise<T>): HamzaTaskRepo {
  return {
    kind,
    create: (task) => mutate((store) => createIn(store, task)),
    get: async (id) => {
      const found = (await read()).tasks.find((task) => task.id === id);
      return found ? clone(found) : undefined;
    },
    update: (id, from, patch) => mutate((store) => updateIn(store, id, from, patch)),
    claimNext: (workerId, now, leaseMs) => mutate((store) => claimIn(store, workerId, now, leaseMs)),
    listByChannel: async (channel, limit) =>
      clone((await read()).tasks.filter((task) => task.channel === channel).slice(-limit)),
    listRecent: async (limit) => clone([...(await read()).tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)),
    listActive: async () => clone((await read()).tasks.filter((task) => ACTIVE.includes(task.status))),
    addStep: (taskId, step) => mutate((store) => addStepIn(store, taskId, step)),
    listSteps: async (taskId, limit) => clone(((await read()).steps[taskId] ?? []).slice(-limit)),
    monthSpentUsd: async (sinceIso) => monthSpentIn(await read(), sinceIso),
  };
}

/** In-process repo (tests, evals). */
export function memoryTaskRepo(store: TaskStore = emptyTaskStore()): HamzaTaskRepo & { store: TaskStore } {
  const repo = engineRepo("memory", async () => store, async (fn) => fn(store));
  return Object.assign(repo, { store });
}
