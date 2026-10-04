/** JSON-file task store (data/hamza-tasks.json) when DATABASE_URL is unset — single instance only. */
import { readJsonFile, withStoreLock, writeJsonFile } from "@/lib/dataDir";
import { emptyTaskStore, engineRepo, type TaskStore } from "./engine";
import type { HamzaTaskRepo } from "./types";

const FILE = "hamza-tasks.json";

async function read(): Promise<TaskStore> {
  const raw = await readJsonFile<Partial<TaskStore>>(FILE, emptyTaskStore());
  return { tasks: Array.isArray(raw.tasks) ? raw.tasks : [], steps: raw.steps && typeof raw.steps === "object" ? raw.steps : {} };
}

async function mutate<T>(fn: (store: TaskStore) => T): Promise<T> {
  return withStoreLock(FILE, async () => {
    const store = await read();
    const value = fn(store);
    await writeJsonFile(FILE, store);
    return value;
  });
}

export const fileTaskRepo: HamzaTaskRepo = engineRepo("file", read, mutate);
