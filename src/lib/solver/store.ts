import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import type { MathQueryRecord, VideoJobStatus } from "./types";

const STORE_FILE = "math-queries.json";

type QueryStore = { queries: MathQueryRecord[] };

async function readQueryStore(): Promise<QueryStore> {
  const parsed = await readJsonFile<Partial<QueryStore>>(STORE_FILE, { queries: [] });
  return { queries: Array.isArray(parsed.queries) ? parsed.queries : [] };
}

async function writeQueryStore(store: QueryStore) {
  await writeJsonFile(STORE_FILE, store);
}

export async function saveMathQuery(record: Omit<MathQueryRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const store = await readQueryStore();
  const now = new Date().toISOString();
  const next: MathQueryRecord = {
    ...record,
    id: record.id || createId("math"),
    createdAt: now,
    updatedAt: now,
  };
  store.queries.unshift(next);
  await writeQueryStore(store);
  return next;
}

export async function getMathQuery(id: string) {
  const store = await readQueryStore();
  return store.queries.find((item) => item.id === id);
}

export async function listMathQueries(filter?: { userId?: string; limit?: number }) {
  const store = await readQueryStore();
  let rows = store.queries;
  if (filter?.userId) rows = rows.filter((item) => item.userId === filter.userId);
  const limit = filter?.limit ?? 200;
  return rows.slice(0, limit);
}

export async function patchMathQuery(id: string, patch: Partial<MathQueryRecord>) {
  const store = await readQueryStore();
  const index = store.queries.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.queries[index] = {
    ...store.queries[index],
    ...patch,
    id: store.queries[index].id,
    createdAt: store.queries[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  await writeQueryStore(store);
  return store.queries[index];
}

export async function setQueryVideo(id: string, patch: { videoStatus: VideoJobStatus; heygenJobId?: string; videoUrl?: string }) {
  return patchMathQuery(id, patch);
}

export function publicQuery(record: MathQueryRecord, { includeTimeline = true } = {}) {
  if (includeTimeline) return record;
  const { timeline, ...rest } = record;
  void timeline;
  return rest;
}
