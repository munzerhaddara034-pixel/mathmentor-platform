import { readJsonFile, writeJsonFile } from "../dataDir";
import { createId } from "../ids";
import { getSampleLesson } from "./sampleLessons";
import { officialExamFourPhaseLesson } from "./seedLesson";
import { parseLessonTimeline, type LessonTimeline } from "./timeline";
import {
  DEMO_AVATAR_VIDEO,
  DEMO_POSTER,
  deterministicDemoVideoId,
  type HeyGenLanguage,
} from "./heygen";

const JOBS_FILE = "heygen-jobs.json";

export const HEYGEN_JOB_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export type HeyGenJobStatus = (typeof HEYGEN_JOB_STATUSES)[number];

export type HeyGenJobRecord = {
  id: string;
  lessonId: string;
  title: string;
  script: string;
  notes: string;
  mathExamples: string;
  language: HeyGenLanguage;
  speed: number;
  status: HeyGenJobStatus;
  heygenVideoId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  studentEnabled: boolean;
  demo: boolean;
  message: string;
  timelineJson?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioLessonOverlay = {
  lessonId: string;
  jobId: string;
  videoUrl?: string;
  heygenVideoId?: string;
  studentEnabled: boolean;
  updatedAt: string;
};

type HeyGenJobStore = {
  jobs: HeyGenJobRecord[];
  lessons: Record<string, StudioLessonOverlay>;
};

const MOCK_QUEUED_MS = 800;
const MOCK_COMPLETE_MS = 2500;

function emptyStore(): HeyGenJobStore {
  return { jobs: [], lessons: {} };
}

async function readJobStore(): Promise<HeyGenJobStore> {
  const parsed = await readJsonFile<Partial<HeyGenJobStore>>(JOBS_FILE, emptyStore());
  return {
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
    lessons: parsed.lessons && typeof parsed.lessons === "object" ? parsed.lessons : {},
  };
}

async function writeJobStore(store: HeyGenJobStore): Promise<HeyGenJobStore> {
  await writeJsonFile(JOBS_FILE, store);
  return store;
}

function publicJob(job: HeyGenJobRecord): HeyGenJobRecord {
  return { ...job };
}

export function playerPathForJob(job: Pick<HeyGenJobRecord, "id" | "lessonId" | "studentEnabled">) {
  if (job.studentEnabled) return `/lessons/interactive?job=${encodeURIComponent(job.id)}`;
  return `/studio/player?job=${encodeURIComponent(job.id)}`;
}

function ageMs(job: HeyGenJobRecord) {
  const t = Date.parse(job.createdAt);
  return Number.isFinite(t) ? Date.now() - t : 0;
}

function advanceMockJob(job: HeyGenJobRecord): HeyGenJobRecord {
  if (!job.demo || job.status === "completed" || job.status === "failed") return job;
  const age = ageMs(job);
  const now = new Date().toISOString();
  if (age >= MOCK_COMPLETE_MS) {
    return {
      ...job,
      status: "completed",
      videoUrl: DEMO_AVATAR_VIDEO,
      thumbnailUrl: job.thumbnailUrl ?? DEMO_POSTER,
      studentEnabled: true,
      message:
        "Demo job completed locally. Placeholder video: /studio/demo-avatar.mp4 (HeyGen was not called). Lesson is enabled for students.",
      updatedAt: now,
    };
  }
  if (age >= MOCK_QUEUED_MS) {
    return {
      ...job,
      status: "processing",
      message: "Demo job processing (local mock — no HeyGen network call).",
      updatedAt: now,
    };
  }
  return job;
}

function enableLesson(store: HeyGenJobStore, job: HeyGenJobRecord) {
  if (!job.lessonId || job.status !== "completed") return;
  store.lessons[job.lessonId] = {
    lessonId: job.lessonId,
    jobId: job.id,
    videoUrl: job.videoUrl,
    heygenVideoId: job.heygenVideoId,
    studentEnabled: true,
    updatedAt: job.updatedAt,
  };
}

export async function listHeyGenJobs(): Promise<HeyGenJobRecord[]> {
  const store = await readJobStore();
  let dirty = false;
  store.jobs = store.jobs.map((job) => {
    const next = advanceMockJob(job);
    if (next !== job && (next.status !== job.status || next.videoUrl !== job.videoUrl)) {
      dirty = true;
      if (next.status === "completed") enableLesson(store, next);
    }
    return next;
  });
  if (dirty) await writeJobStore(store);
  return store.jobs.map(publicJob);
}

export async function getHeyGenJob(id: string): Promise<HeyGenJobRecord | undefined> {
  const store = await readJobStore();
  const index = store.jobs.findIndex((job) => job.id === id || job.heygenVideoId === id);
  if (index < 0) return undefined;
  const advanced = advanceMockJob(store.jobs[index]);
  if (advanced.status !== store.jobs[index].status || advanced.videoUrl !== store.jobs[index].videoUrl) {
    store.jobs[index] = advanced;
    if (advanced.status === "completed") enableLesson(store, advanced);
    await writeJobStore(store);
  }
  return publicJob(store.jobs[index]);
}

export async function getLessonOverlay(lessonId: string): Promise<StudioLessonOverlay | undefined> {
  const store = await readJobStore();
  return store.lessons[lessonId];
}

export async function upsertHeyGenJob(input: Omit<HeyGenJobRecord, "createdAt" | "updatedAt"> & { id?: string }): Promise<HeyGenJobRecord> {
  const store = await readJobStore();
  const now = new Date().toISOString();
  const existing = input.id ? store.jobs.find((job) => job.id === input.id) : undefined;
  if (existing) {
    const next: HeyGenJobRecord = {
      ...existing,
      ...input,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    const index = store.jobs.findIndex((job) => job.id === existing.id);
    store.jobs[index] = next;
    if (next.status === "completed") enableLesson(store, next);
    await writeJobStore(store);
    return publicJob(next);
  }
  const record: HeyGenJobRecord = {
    ...input,
    id: input.id || createId("heygen"),
    createdAt: now,
    updatedAt: now,
  };
  store.jobs.unshift(record);
  if (record.status === "completed") enableLesson(store, record);
  await writeJobStore(store);
  return publicJob(record);
}

export async function patchHeyGenJob(id: string, patch: Partial<HeyGenJobRecord>): Promise<HeyGenJobRecord | undefined> {
  const store = await readJobStore();
  const index = store.jobs.findIndex((job) => job.id === id || job.heygenVideoId === id);
  if (index < 0) return undefined;
  const next: HeyGenJobRecord = {
    ...store.jobs[index],
    ...patch,
    id: store.jobs[index].id,
    updatedAt: new Date().toISOString(),
  };
  store.jobs[index] = next;
  if (next.status === "completed") {
    next.studentEnabled = patch.studentEnabled ?? true;
    store.jobs[index] = next;
    enableLesson(store, next);
  }
  await writeJobStore(store);
  return publicJob(next);
}

export function newQueuedJob(input: {
  lessonId: string;
  title: string;
  script: string;
  notes: string;
  mathExamples: string;
  language: HeyGenLanguage;
  speed: number;
  timelineJson?: string;
  demo: boolean;
}): HeyGenJobRecord {
  const now = new Date().toISOString();
  const id = input.demo
    ? deterministicDemoVideoId(input.lessonId, input.script, input.language)
    : createId("heygen");
  return {
    id,
    lessonId: input.lessonId,
    title: input.title,
    script: input.script,
    notes: input.notes,
    mathExamples: input.mathExamples,
    language: input.language,
    speed: input.speed,
    status: "queued",
    heygenVideoId: input.demo ? id : undefined,
    thumbnailUrl: DEMO_POSTER,
    studentEnabled: false,
    demo: input.demo,
    message: input.demo
      ? "Queued in demo mode. Poll GET /api/heygen/status?jobId=… — HeyGen is not called without HEYGEN_API_KEY."
      : "Queued. Waiting for HeyGen video_id.",
    timelineJson: input.timelineJson,
    createdAt: now,
    updatedAt: now,
  };
}

export function resolveJobTimeline(job: HeyGenJobRecord): LessonTimeline {
  if (job.timelineJson?.trim()) {
    try {
      const parsed = parseLessonTimeline(JSON.parse(job.timelineJson) as unknown);
      if (parsed.success) return attachJobMedia(parsed.data, job);
    } catch {
      /* fall through to samples */
    }
  }
  const base =
    job.lessonId === "leb-term-func-01" || !job.lessonId
      ? officialExamFourPhaseLesson
      : getSampleLesson(job.lessonId);
  return attachJobMedia(base, job);
}

export function attachJobMedia(timeline: LessonTimeline, job: Pick<HeyGenJobRecord, "id" | "videoUrl" | "heygenVideoId" | "studentEnabled">): LessonTimeline {
  return {
    ...timeline,
    media: {
      ...(timeline.media ?? {}),
      poster: timeline.media?.poster ?? DEMO_POSTER,
      videoUrl: job.videoUrl,
      heygenVideoId: job.heygenVideoId,
      heygenJobId: job.id,
      studentEnabled: job.studentEnabled,
    },
  };
}

export async function timelineForStudentLesson(lessonId: string, fallback: LessonTimeline): Promise<LessonTimeline> {
  const overlay = await getLessonOverlay(lessonId);
  if (!overlay?.studentEnabled) return fallback;
  return attachJobMedia(fallback, {
    id: overlay.jobId,
    videoUrl: overlay.videoUrl,
    heygenVideoId: overlay.heygenVideoId,
    studentEnabled: overlay.studentEnabled,
  });
}
