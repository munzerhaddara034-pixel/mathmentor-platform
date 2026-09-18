import { readJsonFile, writeJsonFile } from "../dataDir";
import { canvasActionSchema, type CanvasAction } from "./timeline";

const EVENTS_FILE = "studio-events.json";

type StudioEventsStore = {
  lessons: Record<string, { events: CanvasAction[]; updatedAt: string }>;
};

function emptyStore(): StudioEventsStore {
  return { lessons: {} };
}

async function readStore(): Promise<StudioEventsStore> {
  const parsed = await readJsonFile<Partial<StudioEventsStore>>(EVENTS_FILE, emptyStore());
  return { lessons: parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {} };
}

async function writeStore(store: StudioEventsStore) {
  await writeJsonFile(EVENTS_FILE, store);
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
