import { appendAuditLogLocked, type AuditInput } from "./security/audit";
import { DuplicateCardCodeError, cleanCardPrefix, generateCardCodes, normalizeCardCode } from "./cards/codes";
import { readJsonFile, withDocumentLock, writeJsonFile } from "./dataDir";
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

const STORE_FILE = "store.json";

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
    // No demo/test cards: staff generate real codes from the teacher console.
    scratchCards: [],
    quizAttempts: [],
    customQuestions: [],
    entitlements: [],
    exams: [],
  };
}

function isStoreShape(value: unknown): value is StoreData {
  const parsed = value as Partial<StoreData> | null;
  return Boolean(parsed && typeof parsed === "object" && Array.isArray(parsed.library) && Array.isArray(parsed.drafts));
}

/**
 * Read + normalise store.json. A malformed document is reset to the seed under the document lock
 * (re-checked first, so a concurrent writer is never clobbered). Backend errors (e.g. Postgres down)
 * now surface instead of overwriting the stored data with the seed.
 */
async function ensureStore(): Promise<StoreData> {
  const initial = withFeaturedLesson(seed());
  const first = await readJsonFile<StoreData>(STORE_FILE, initial);
  if (isStoreShape(first)) return normalizeStore(first);
  return withDocumentLock(STORE_FILE, async () => {
    const again = await readJsonFile<StoreData>(STORE_FILE, initial);
    if (isStoreShape(again)) return normalizeStore(again);
    await writeJsonFile(STORE_FILE, initial);
    return initial;
  });
}

function normalizeStore(parsed: StoreData): StoreData {
  parsed.managerMessages ??= [];
  parsed.outreach ??= [];
  parsed.settings ??= defaultSettings;
  if (!parsed.settings.phone || parsed.settings.phone.includes("71 000") || String(parsed.settings.whatsapp ?? "").includes("71000000")) {
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
  if (!Array.isArray(parsed.settings.plans)) parsed.settings = { ...parsed.settings, plans: [] };
  const planIds = new Set(parsed.settings.plans.map((plan) => plan.id));
  for (const plan of defaultSettings.plans) {
    if (!planIds.has(plan.id)) parsed.settings.plans.push(plan);
  }
  // Keep subscription marketing labels in sync with defaultSettings (ids/prices stay stable).
  parsed.settings.plans = parsed.settings.plans.map((plan) => {
    const fresh = defaultSettings.plans.find((item) => item.id === plan.id);
    if (!fresh) return plan;
    return {
      ...plan,
      name: fresh.name,
      arabicName: fresh.arabicName,
      includes: fresh.includes,
      usdMonthly: fresh.usdMonthly,
      usdTerm: fresh.usdTerm,
      tier: fresh.tier,
      liveCredits: fresh.liveCredits,
    };
  });
  return withFeaturedLesson(parsed);
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
  await writeJsonFile(STORE_FILE, data);
  return data;
}

export async function addLibraryItem(item: LibraryItem): Promise<LibraryItem> {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.library.unshift(item);
    await writeStore(store);
    return item;
  });
}

export async function addDrafts(drafts: ContentDraft[]): Promise<ContentDraft[]> {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.drafts.unshift(...drafts);
    await writeStore(store);
    return drafts;
  });
}

export async function updateDraft(
  id: string,
  patch: Partial<ContentDraft>,
): Promise<ContentDraft | undefined> {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    const index = store.drafts.findIndex((draft) => draft.id === id);
    if (index < 0) return undefined;
    store.drafts[index] = { ...store.drafts[index], ...patch };
    await writeStore(store);
    return store.drafts[index];
  });
}

export async function addManagerMessage(message: ManagerMessage) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.managerMessages.push(message);
    await writeStore(store);
    return message;
  });
}

export async function addOutreach(item: OutreachDraft) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.outreach.unshift(item);
    await writeStore(store);
    return item;
  });
}

export async function reviewOutreach(id: string, status: OutreachDraft["status"], professorNote?: string) {
  return withDocumentLock(STORE_FILE, async () => {
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
  });
}

export async function patchSettings(patch: Partial<PlatformSettings>) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.settings = { ...store.settings, ...patch, plans: patch.plans ?? store.settings.plans };
    await writeStore(store);
    return store.settings;
  });
}

export async function addCustomLesson(lesson: AcademyLessonRecord) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.customLessons.unshift(lesson);
    await writeStore(store);
    return lesson;
  });
}

export async function addStudentChat(message: StudentChatMessage) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.studentChat.push(message);
    await writeStore(store);
    return message;
  });
}

export async function addProgress(entry: ProgressEntry) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.progress = store.progress.filter((item) => item.lessonId !== entry.lessonId);
    store.progress.push(entry);
    await writeStore(store);
    return store.progress;
  });
}

export async function addQuizAttempt(attempt: QuizAttempt) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.quizAttempts.unshift(attempt);
    await writeStore(store);
    return attempt;
  });
}

/** The store document key (mm_documents.key on Postgres). */
export const STORE_DOCUMENT_KEY = STORE_FILE;

/**
 * Claim one scratch card. Atomic: read → check → mark used → write runs under withDocumentLock
 * (in-process mutex; on Postgres advisory + row lock in one transaction), so two concurrent redeems
 * of the same single-use card can never both succeed. Called inside redeemCode's wider lock.
 */
export async function redeemCard(code: string, studentName: string, phone?: string, userId?: string) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    const wanted = code.trim().toLowerCase();
    const card = store.scratchCards.find((item) => item.code.toLowerCase() === wanted);
    if (!card) return { ok: false as const, error: "رمز غير صحيح", reason: "unknown" as const };
    if (card.used && !card.reusable) return { ok: false as const, error: "هذه البطاقة مستخدمة", reason: "used" as const };
    if (card.expiresAt && new Date(card.expiresAt).getTime() < Date.now()) {
      return { ok: false as const, error: "انتهت صلاحية هذا الكود", reason: "expired" as const };
    }
    if (!card.reusable) card.used = true;
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
    return { ok: true as const, planId: card.planId, entitlement, code: card.code };
  });
}

export async function addCustomQuestion(question: QuizQuestion) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.customQuestions.unshift(question);
    await writeStore(store);
    return question;
  });
}

/**
 * Admin-only (enforced by /api/cards). Codes come from node:crypto (cards/codes.ts); a custom single
 * code that already exists is refused (DuplicateCardCodeError) instead of silently duplicated.
 */
export async function createScratchCards(input: {
  code?: string;
  planId: string;
  count?: number;
  note?: string;
  expiresAt?: string;
}, options?: { audit?: (created: ScratchCard[]) => AuditInput }) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    const count = Math.min(Math.max(Math.floor(Number(input.count ?? 1)) || 1, 1), 100);
    const batchId = createId("batch");
    const existing = store.scratchCards.map((card) => card.code);
    let codes: string[];
    if (count === 1 && input.code?.trim()) {
      const custom = normalizeCardCode(input.code);
      if (existing.some((code) => code.toUpperCase() === custom)) throw new DuplicateCardCodeError();
      codes = [custom];
    } else {
      codes = generateCardCodes(cleanCardPrefix(input.code, "MUNZER"), count, existing);
    }
    const createdAt = new Date().toISOString();
    const created: ScratchCard[] = codes.map((code) => ({
      code,
      planId: input.planId,
      used: false,
      createdAt,
      expiresAt: input.expiresAt || undefined,
      batchId,
      note: input.note,
    }));
    store.scratchCards.unshift(...created);
    await writeStore(store);
    // Same transaction as the cards on Postgres: no card exists without its audit row.
    if (options?.audit) await appendAuditLogLocked(options.audit(created));
    return created;
  });
}

export async function addExam(exam: ExamPaper) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    store.exams.unshift(exam);
    await writeStore(store);
    return exam;
  });
}

export async function updateCustomQuestion(id: string, patch: Partial<QuizQuestion>) {
  return withDocumentLock(STORE_FILE, async () => {
    const store = await readStore();
    const index = store.customQuestions.findIndex((item) => item.id === id);
    if (index < 0) return undefined;
    store.customQuestions[index] = { ...store.customQuestions[index], ...patch };
    await writeStore(store);
    return store.customQuestions[index];
  });
}
