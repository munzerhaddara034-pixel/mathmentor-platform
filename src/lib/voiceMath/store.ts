import { readJsonFile, writeJsonFile, withStoreLock } from "@/lib/dataDir";
import { createId } from "@/lib/ids";
import type { StoredAudio, VoiceMathJob } from "./types";

const JOBS_FILE = "voice-math.json";

type VoiceStore = { jobs: VoiceMathJob[] };

async function readStore(): Promise<VoiceStore> {
  const parsed = await readJsonFile<Partial<VoiceStore>>(JOBS_FILE, { jobs: [] });
  return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
}

async function writeStore(store: VoiceStore) {
  await writeJsonFile(JOBS_FILE, store);
}

function audioKey(id: string) {
  return `voice-audio-${id}.json`;
}

export async function saveVoiceAudio(id: string, audio: StoredAudio) {
  await writeJsonFile(audioKey(id), audio);
}

export async function getVoiceAudio(id: string): Promise<StoredAudio | undefined> {
  const data = await readJsonFile<StoredAudio | null>(audioKey(id), null, { persistFallback: false });
  if (!data || typeof data.base64 !== "string" || !data.base64) return undefined;
  return data;
}

export async function saveVoiceJob(record: Omit<VoiceMathJob, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return withStoreLock(JOBS_FILE, async () => {
    const store = await readStore();
    const now = new Date().toISOString();
    const next: VoiceMathJob = {
      ...record,
      id: record.id || createId("voice"),
      createdAt: now,
      updatedAt: now,
    };
    store.jobs.unshift(next);
    await writeStore(store);
    return next;
  });
}

export async function getVoiceJob(id: string) {
  const store = await readStore();
  return store.jobs.find((item) => item.id === id);
}

export async function listVoiceJobs(filter?: { userId?: string; limit?: number }) {
  const store = await readStore();
  let rows = store.jobs;
  if (filter?.userId) rows = rows.filter((item) => item.userId === filter.userId);
  return rows.slice(0, filter?.limit ?? 80);
}

export async function patchVoiceJob(id: string, patch: Partial<VoiceMathJob>) {
  return withStoreLock(JOBS_FILE, async () => {
    const store = await readStore();
    const index = store.jobs.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    store.jobs[index] = {
      ...store.jobs[index],
      ...patch,
      id: store.jobs[index].id,
      createdAt: store.jobs[index].createdAt,
      updatedAt: new Date().toISOString(),
    };
    await writeStore(store);
    return store.jobs[index];
  });
}

export function publicVoiceJob(job: VoiceMathJob) {
  return job;
}
