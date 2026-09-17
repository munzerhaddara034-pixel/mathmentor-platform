import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lebaneseCatalog } from "./curriculum";
import { GRADE_12_LS_CH1_ID, grade12LsCh1Draft } from "./grade12LsCh1";
import { createId } from "./ids";
import { defaultSettings } from "./settings";
import type {
  AcademyLessonRecord,
  ContentDraft,
  LibraryItem,
  ManagerMessage,
  OutreachDraft,
  PlatformSettings,
  ProgressEntry,
  Entitlement,
  ExamPaper,
  QuizAttempt,
  QuizQuestion,
  ScratchCard,
  StoreData,
  StudentChatMessage,
} from "./types";

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "store.json");

function seed(): StoreData {
  const now = new Date().toISOString();
  const library: LibraryItem[] = lebaneseCatalog.map((item) => ({
    ...item,
    id: createId("lib"),
    createdAt: now,
  }));
  return {
    library,
    drafts: [],
    managerMessages: [],
    outreach: [],
    settings: defaultSettings,
    studentChat: [],
    progress: [],
    customLessons: [],
    scratchCards: [
      { code: "MUNZER-GOLD-9A", planId: "all", used: false },
      { code: "MUNZER-G12-7K", planId: "g11-12", used: false },
      { code: "BREVET-29-MX", planId: "g7-9", used: false },
      { code: "MUNZER-AI-3K", planId: "ai", used: false },
      { code: "MUNZER-LIVE-4C", planId: "live", used: false },
      { code: "MUNZER-BOTH-1X", planId: "both", used: false },
    ],
    quizAttempts: [],
    customQuestions: [],
    entitlements: [],
    exams: [],
  };
}

async function ensureStore(): Promise<StoreData> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreData;
    if (!Array.isArray(parsed.library) || !Array.isArray(parsed.drafts)) {
      throw new Error("invalid store");
    }
    parsed.managerMessages ??= [];
    parsed.outreach ??= [];
    parsed.settings ??= defaultSettings;
    if (!parsed.settings.phone || parsed.settings.phone.includes("71 000") || parsed.settings.whatsapp.includes("71000000")) {
      parsed.settings = {
        ...parsed.settings,
        phone: defaultSettings.phone,
        whatsapp: defaultSettings.whatsapp,
        contactNote: defaultSettings.contactNote,
      };
    }
    parsed.studentChat ??= [];
    parsed.progress ??= [];
    parsed.customLessons ??= [];
    parsed.scratchCards ??= [];
    parsed.quizAttempts ??= [];
    parsed.customQuestions ??= [];
    parsed.entitlements ??= [];
    parsed.exams ??= [];
    const planIds = new Set((parsed.settings.plans ?? []).map((plan) => plan.id));
    for (const plan of defaultSettings.plans) {
      if (!planIds.has(plan.id)) parsed.settings.plans.push(plan);
    }
    const codes = new Set((parsed.scratchCards ?? []).map((card) => card.code));
    for (const card of [
      { code: "MUNZER-AI-3K", planId: "ai", used: false },
      { code: "MUNZER-LIVE-4C", planId: "live", used: false },
      { code: "MUNZER-BOTH-1X", planId: "both", used: false },
    ]) {
      if (!codes.has(card.code)) parsed.scratchCards.push(card);
    }
    return withFeaturedLesson(parsed);
  } catch {
    const initial = withFeaturedLesson(seed());
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function withFeaturedLesson(store: StoreData): StoreData {
  const featured = grade12LsCh1Draft();
  const drafts = store.drafts.filter((draft) => draft.id !== GRADE_12_LS_CH1_ID);
  drafts.unshift(featured);
  return { ...store, drafts };
}

export async function readStore(): Promise<StoreData> {
  return ensureStore();
}

export async function writeStore(data: StoreData): Promise<StoreData> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(data, null, 2), "utf8");
  return data;
}

export async function addLibraryItem(item: LibraryItem): Promise<LibraryItem> {
  const store = await readStore();
  store.library.unshift(item);
  await writeStore(store);
  return item;
}

export async function addDrafts(drafts: ContentDraft[]): Promise<ContentDraft[]> {
  const store = await readStore();
  store.drafts.unshift(...drafts);
  await writeStore(store);
  return drafts;
}

export async function updateDraft(
  id: string,
  patch: Partial<ContentDraft>,
): Promise<ContentDraft | undefined> {
  const store = await readStore();
  const index = store.drafts.findIndex((draft) => draft.id === id);
  if (index < 0) return undefined;
  store.drafts[index] = { ...store.drafts[index], ...patch };
  await writeStore(store);
  return store.drafts[index];
}

export async function addManagerMessage(message: ManagerMessage) {
  const store = await readStore();
  store.managerMessages.push(message);
  await writeStore(store);
  return message;
}

export async function addOutreach(item: OutreachDraft) {
  const store = await readStore();
  store.outreach.unshift(item);
  await writeStore(store);
  return item;
}

export async function reviewOutreach(id: string, status: OutreachDraft["status"], professorNote?: string) {
  const store = await readStore();
  const index = store.outreach.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.outreach[index] = {
    ...store.outreach[index],
    status,
    professorNote,
    reviewedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return store.outreach[index];
}

export async function patchSettings(patch: Partial<PlatformSettings>) {
  const store = await readStore();
  store.settings = { ...store.settings, ...patch, plans: patch.plans ?? store.settings.plans };
  await writeStore(store);
  return store.settings;
}

export async function addCustomLesson(lesson: AcademyLessonRecord) {
  const store = await readStore();
  store.customLessons.unshift(lesson);
  await writeStore(store);
  return lesson;
}

export async function addStudentChat(message: StudentChatMessage) {
  const store = await readStore();
  store.studentChat.push(message);
  await writeStore(store);
  return message;
}

export async function addProgress(entry: ProgressEntry) {
  const store = await readStore();
  store.progress = store.progress.filter((item) => item.lessonId !== entry.lessonId);
  store.progress.push(entry);
  await writeStore(store);
  return store.progress;
}

export async function addQuizAttempt(attempt: QuizAttempt) {
  const store = await readStore();
  store.quizAttempts.unshift(attempt);
  await writeStore(store);
  return attempt;
}

export async function redeemCard(code: string, studentName: string, phone?: string, userId?: string) {
  const store = await readStore();
  const card = store.scratchCards.find((item) => item.code.toLowerCase() === code.trim().toLowerCase());
  if (!card) return { ok: false as const, error: "رمز غير صحيح" };
  if (card.used) return { ok: false as const, error: "هذه البطاقة مستخدمة" };
  if (card.expiresAt && new Date(card.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "انتهت صلاحية هذا الكود" };
  }
  card.used = true;
  card.usedBy = studentName;
  card.usedPhone = phone;
  const entitlement: Entitlement = {
    id: createId("ent"),
    studentName,
    phone,
    planId: card.planId,
    unlockedAt: new Date().toISOString(),
    userId,
  };
  store.entitlements.unshift(entitlement);
  await writeStore(store);
  return { ok: true as const, planId: card.planId, entitlement };
}

export async function addCustomQuestion(question: QuizQuestion) {
  const store = await readStore();
  store.customQuestions.unshift(question);
  await writeStore(store);
  return question;
}

export async function createScratchCards(input: {
  code?: string;
  planId: string;
  count?: number;
  note?: string;
  expiresAt?: string;
}) {
  const store = await readStore();
  const count = Math.min(Math.max(input.count ?? 1, 1), 100);
  const batchId = createId("batch");
  const created: ScratchCard[] = [];
  for (let i = 0; i < count; i += 1) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const code =
      count === 1 && input.code?.trim()
        ? input.code.trim().toUpperCase()
        : `${(input.code || "MUNZER").trim().toUpperCase()}-${suffix}`;
    created.push({
      code,
      planId: input.planId,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt || undefined,
      batchId,
      note: input.note,
    });
  }
  store.scratchCards.unshift(...created);
  await writeStore(store);
  return created;
}

export async function addExam(exam: ExamPaper) {
  const store = await readStore();
  store.exams.unshift(exam);
  await writeStore(store);
  return exam;
}

export async function updateCustomQuestion(id: string, patch: Partial<QuizQuestion>) {
  const store = await readStore();
  const index = store.customQuestions.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  store.customQuestions[index] = { ...store.customQuestions[index], ...patch };
  await writeStore(store);
  return store.customQuestions[index];
}
