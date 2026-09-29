import { createId } from "@/lib/ids";
import { readJsonFile, writeJsonFile } from "@/lib/dataDir";
import { OFFICIAL_PAPERS } from "./papers";
import type { ExamAttempt, GeneratedSimilarSet } from "./types";

const FILE = "exam-attempts.json";

type AttemptStore = { attempts: ExamAttempt[] };

async function readAttempts(): Promise<AttemptStore> {
  const data = await readJsonFile<AttemptStore>(FILE, { attempts: [] });
  return { attempts: Array.isArray(data.attempts) ? data.attempts : [] };
}

async function writeAttempts(store: AttemptStore) {
  await writeJsonFile(FILE, store);
}

export async function saveExamAttempt(attempt: Omit<ExamAttempt, "id" | "createdAt"> & { id?: string }) {
  const store = await readAttempts();
  const record: ExamAttempt = {
    ...attempt,
    id: attempt.id ?? createId("examatt"),
    createdAt: new Date().toISOString(),
  };
  store.attempts.unshift(record);
  await writeAttempts(store);
  return record;
}

export async function getExamAttempt(id: string) {
  const store = await readAttempts();
  return store.attempts.find((item) => item.id === id);
}

export async function listExamAttempts(filter?: { userId?: string; paperId?: string }) {
  const store = await readAttempts();
  return store.attempts.filter((item) => {
    if (filter?.userId && item.userId !== filter.userId) return false;
    if (filter?.paperId && item.paperId !== filter.paperId) return false;
    return true;
  });
}

export function publicPapers() {
  return OFFICIAL_PAPERS.map((paper) => ({
    id: paper.id,
    track: paper.track,
    title: paper.title,
    titleAr: paper.titleAr,
    sessionLabel: paper.sessionLabel,
    durationMinutes: paper.durationMinutes,
    totalMarks: paper.totalMarks,
  }));
}

const GENERATED_FILE = "exam-generated.json";

type GeneratedStore = { sets: GeneratedSimilarSet[] };

async function readGenerated(): Promise<GeneratedStore> {
  const data = await readJsonFile<GeneratedStore>(GENERATED_FILE, { sets: [] });
  return { sets: Array.isArray(data.sets) ? data.sets : [] };
}

async function writeGenerated(store: GeneratedStore) {
  await writeJsonFile(GENERATED_FILE, store);
}

export async function saveGeneratedSet(set: GeneratedSimilarSet) {
  const store = await readGenerated();
  store.sets.unshift(set);
  store.sets = store.sets.slice(0, 200);
  await writeGenerated(store);
  return set;
}

export async function listGeneratedSets(filter?: { userId?: string; paperId?: string }) {
  const store = await readGenerated();
  return store.sets.filter((item) => {
    if (filter?.userId && item.userId !== filter.userId) return false;
    if (filter?.paperId && item.paperId !== filter.paperId) return false;
    return true;
  });
}

export async function getGeneratedSet(id: string) {
  const store = await readGenerated();
  return store.sets.find((item) => item.id === id);
}
