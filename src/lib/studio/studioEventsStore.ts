import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { platformDataDir } from "../dataDir";
import { canvasActionSchema, type CanvasAction } from "./timeline";

const dataDir = platformDataDir();
const eventsPath = path.join(dataDir, "studio-events.json");

type StudioEventsStore = {
  lessons: Record<string, { events: CanvasAction[]; updatedAt: string }>;
};

function emptyStore(): StudioEventsStore {
  return { lessons: {} };
}

async function readStore(): Promise<StudioEventsStore> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(eventsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StudioEventsStore>;
    return { lessons: parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {} };
  } catch {
    const initial = emptyStore();
    await writeFile(eventsPath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

async function writeStore(store: StudioEventsStore) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(eventsPath, JSON.stringify(store, null, 2), "utf8");
}

export async function getStudioEvents(lessonId: string): Promise<CanvasAction[] | undefined> {
  const store = await readStore();
  return store.lessons[lessonId]?.events;
}

export async function saveStudioEvents(lessonId: string, events: CanvasAction[]) {
  const parsed = canvasActionSchema.array().safeParse(events);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid events");
  }
  const store = await readStore();
  const record = { events: parsed.data, updatedAt: new Date().toISOString() };
  store.lessons[lessonId] = record;
  await writeStore(store);
  return record;
}
