import {
  bankDifficultyToLevel,
  contestFromBank,
  differentialPool,
  getTopicBank,
  quizQuestionsForBank,
  topicBanks,
  type TopicBank,
  type TopicBankQuestion,
} from "./topicBanks";
import type { QuizQuestion, SessionKind } from "./types";

export type CertificateBranch = "Brevet" | "LS" | "GS" | "SE" | "LH";
export type CatalogTopicId =
  | "functions"
  | "complex"
  | "probability"
  | "analytic-geometry"
  | "sequences"
  | "differential";

export type ExamPackKind = "full-paper" | "topic-drill" | "bank-contest" | "bank-free";

export type ExamPartSpec = {
  id: string;
  roman: string;
  arabicLabel: string;
  englishLabel: string;
  catalogTopic?: CatalogTopicId | string;
  bankId?: string;
  points: number;
};

export type ExamPackMeta = {
  id: string;
  kind: ExamPackKind;
  certificate: CertificateBranch;
  year?: number;
  session?: SessionKind;
  topicId?: CatalogTopicId | string;
  bankId?: string;
  title: string;
  arabicTitle: string;
  durationMinutes: number;
  passScore: number;
  totalPoints: number;
  parts: ExamPartSpec[];
  disclaimer: string;
  styleTag: string;
  verbatimPastPaper: false;
  questionCount: number;
};

export type AssembledExam = {
  pack: ExamPackMeta;
  questions: QuizQuestion[];
};

export const EXAM_YEARS = [2023, 2024, 2025] as const;
export const EXAM_SESSIONS: { id: SessionKind; arabic: string; english: string }[] = [
  { id: "ordinary", arabic: "عادية", english: "Ordinary" },
  { id: "extraordinary", arabic: "استثنائية", english: "Extraordinary" },
];

export const CERTIFICATE_META: Record<
  CertificateBranch,
  { arabic: string; english: string; durationMinutes: number; totalPoints: number }
> = {
  Brevet: { arabic: "الشهادة المتوسطة", english: "Brevet", durationMinutes: 120, totalPoints: 20 },
  LS: { arabic: "علوم الحياة", english: "Terminale LS", durationMinutes: 180, totalPoints: 20 },
  GS: { arabic: "علوم عامة", english: "Terminale GS", durationMinutes: 240, totalPoints: 20 },
  SE: { arabic: "اجتماع واقتصاد", english: "Terminale SE", durationMinutes: 180, totalPoints: 20 },
  LH: { arabic: "آداب وإنسانيات", english: "Terminale LH", durationMinutes: 180, totalPoints: 20 },
};

export const CATALOG_TOPICS: {
  id: CatalogTopicId;
  arabic: string;
  english: string;
}[] = [
  { id: "functions", arabic: "الدوال", english: "Functions" },
  { id: "complex", arabic: "الأعداد المركبة", english: "Complex Numbers" },
  { id: "probability", arabic: "الاحتمالات", english: "Probability" },
  { id: "analytic-geometry", arabic: "الهندسة التحليلية", english: "Analytic Geometry" },
  { id: "sequences", arabic: "المتتاليات", english: "Sequences" },
  { id: "differential", arabic: "المعادلات التفاضلية", english: "Differential Equations" },
];

/** Existing banks → canonical catalog topic (space geometry counts as 3D analytic). */
export const BANK_CATALOG_TOPIC: Record<string, CatalogTopicId | string> = {
  "g12-ls-functions": "functions",
  "g12-se-functions": "functions",
  "g12-gs-functions": "functions",
  "g12-lh-functions": "functions",
  "g12-gs-complex": "complex",
  "g12-ls-probability": "probability",
  "g12-se-probability": "probability",
  "g12-gs-probability": "probability",
  "g12-lh-probability": "probability",
  "brevet-coordinate": "analytic-geometry",
  "g12-lh-analytic-geometry": "analytic-geometry",
  "g12-ls-space-geometry": "analytic-geometry",
  "g12-gs-space-geometry": "analytic-geometry",
  "g12-ls-sequences": "sequences",
  "g12-gs-sequences": "sequences",
  "g12-se-sequences": "sequences",
  "g12-lh-sequences": "sequences",
  "g12-gs-differential": "differential",
};

export const PRACTICE_DISCLAIMER =
  "نموذج تدريبي من Math Mentor بأسلوب الامتحانات الرسمية اللبنانية. ليست ورقة رسمية صادرة عن وزارة التربية والتعليم العالي، وليست نسخاً حرفياً من دورة سابقة.";

type PaperSlot = {
  roman: string;
  arabicLabel: string;
  englishLabel: string;
  catalogTopic?: CatalogTopicId | string;
  bankId: string;
  points: number;
  count: number;
};

const PAPER_SLOTS: Record<CertificateBranch, PaperSlot[]> = {
  LS: [
    { roman: "I", arabicLabel: "أولاً · أسئلة مختلطة", englishLabel: "Mixed MCQ", bankId: "g12-ls-mcq-mixed", points: 4, count: 4 },
    {
      roman: "II",
      arabicLabel: "ثانياً · هندسة الفضاء",
      englishLabel: "Space geometry",
      catalogTopic: "analytic-geometry",
      bankId: "g12-ls-space-geometry",
      points: 4,
      count: 2,
    },
    {
      roman: "III",
      arabicLabel: "ثالثاً · الاحتمالات",
      englishLabel: "Probability",
      catalogTopic: "probability",
      bankId: "g12-ls-probability",
      points: 4,
      count: 2,
    },
    {
      roman: "IV",
      arabicLabel: "رابعاً · دراسة الدوال",
      englishLabel: "Functions",
      catalogTopic: "functions",
      bankId: "g12-ls-functions",
      points: 8,
      count: 4,
    },
  ],
  GS: [
    { roman: "I", arabicLabel: "أولاً · أسئلة مختلطة", englishLabel: "Mixed MCQ", bankId: "g12-gs-mcq-mixed", points: 4, count: 4 },
    {
      roman: "II",
      arabicLabel: "ثانياً · هندسة الفضاء",
      englishLabel: "Space geometry",
      catalogTopic: "analytic-geometry",
      bankId: "g12-gs-space-geometry",
      points: 3,
      count: 2,
    },
    {
      roman: "III",
      arabicLabel: "ثالثاً · الاحتمالات",
      englishLabel: "Probability",
      catalogTopic: "probability",
      bankId: "g12-gs-probability",
      points: 3,
      count: 2,
    },
    {
      roman: "IV",
      arabicLabel: "رابعاً · الأعداد المركبة",
      englishLabel: "Complex numbers",
      catalogTopic: "complex",
      bankId: "g12-gs-complex",
      points: 4,
      count: 3,
    },
    {
      roman: "V",
      arabicLabel: "خامساً · دراسة الدوال",
      englishLabel: "Functions",
      catalogTopic: "functions",
      bankId: "g12-gs-functions",
      points: 6,
      count: 3,
    },
  ],
  SE: [
    { roman: "I", arabicLabel: "أولاً · أسئلة مختلطة", englishLabel: "Mixed MCQ", bankId: "g12-se-mcq-mixed", points: 6, count: 4 },
    {
      roman: "II",
      arabicLabel: "ثانياً · الاحتمالات والإحصاء",
      englishLabel: "Probability",
      catalogTopic: "probability",
      bankId: "g12-se-probability",
      points: 6,
      count: 3,
    },
    {
      roman: "III",
      arabicLabel: "ثالثاً · الدوال والتحليل الاقتصادي",
      englishLabel: "Functions",
      catalogTopic: "functions",
      bankId: "g12-se-functions",
      points: 8,
      count: 4,
    },
  ],
  Brevet: [
    { roman: "I", arabicLabel: "أولاً · الأعداد", englishLabel: "Numbers", bankId: "brevet-numbers", points: 4, count: 2 },
    { roman: "II", arabicLabel: "ثانياً · الجبر", englishLabel: "Algebra", bankId: "brevet-algebra", points: 4, count: 2 },
    { roman: "III", arabicLabel: "ثالثاً · مسائل لفظية", englishLabel: "Word problems", bankId: "brevet-word-problems", points: 4, count: 2 },
    { roman: "IV", arabicLabel: "رابعاً · الهندسة", englishLabel: "Geometry", bankId: "brevet-geometry", points: 4, count: 2 },
    {
      roman: "V",
      arabicLabel: "خامساً · الهندسة التحليلية",
      englishLabel: "Analytic geometry",
      catalogTopic: "analytic-geometry",
      bankId: "brevet-coordinate",
      points: 4,
      count: 2,
    },
  ],
  LH: [
    {
      roman: "I",
      arabicLabel: "أولاً · الدوال",
      englishLabel: "Functions",
      catalogTopic: "functions",
      bankId: "g12-lh-functions",
      points: 7,
      count: 4,
    },
    {
      roman: "II",
      arabicLabel: "ثانياً · المتتاليات",
      englishLabel: "Sequences",
      catalogTopic: "sequences",
      bankId: "g12-lh-sequences",
      points: 6,
      count: 3,
    },
    {
      roman: "III",
      arabicLabel: "ثالثاً · الاحتمالات",
      englishLabel: "Probability",
      catalogTopic: "probability",
      bankId: "g12-lh-probability",
      points: 7,
      count: 4,
    },
  ],
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const copy = [...items];
  const rand = mulberry32(hashString(seed) || 1);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function distributePoints(count: number, total: number, weights: number[]): number[] {
  if (count <= 0) return [];
  if (count === 1) return [total];
  const safe = weights.map((w) => Math.max(1, w));
  const sum = safe.reduce((a, b) => a + b, 0) || count;
  const raw = safe.map((w) => (w / sum) * total);
  const floors = raw.map((v) => Math.max(1, Math.floor(v)));
  let leftover = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let guard = 0;
  while (leftover !== 0 && guard < 40) {
    guard += 1;
    if (leftover > 0) {
      floors[order[(guard - 1) % order.length].i] += 1;
      leftover -= 1;
    } else {
      const idx = order.find((row) => floors[row.i] > 1)?.i ?? 0;
      if (floors[idx] > 1) {
        floors[idx] -= 1;
        leftover += 1;
      } else break;
    }
  }
  return floors;
}

function sessionArabic(session?: SessionKind) {
  return EXAM_SESSIONS.find((item) => item.id === session)?.arabic ?? "";
}

function poolForBank(bankId: string): TopicBankQuestion[] {
  if (bankId === "g12-gs-differential") return differentialPool();
  return getTopicBank(bankId)?.questions ?? [];
}

function preferStyle(pool: TopicBankQuestion[], year?: number, session?: SessionKind) {
  if (!year && !session) return pool;
  const matched = pool.filter((item) => {
    const yearOk = year == null || item.styleYear == null || item.styleYear === year;
    const sessionOk = !session || !item.session || item.session === session;
    return yearOk && sessionOk;
  });
  return matched.length ? matched : pool;
}

function pickFromBank(
  bankId: string,
  count: number,
  seed: string,
  year?: number,
  session?: SessionKind,
): TopicBankQuestion[] {
  const preferred = preferStyle(poolForBank(bankId), year, session);
  const mixed = [
    ...seededShuffle(preferred.filter((item) => item.difficulty === "easy"), `${seed}-e`),
    ...seededShuffle(preferred.filter((item) => item.difficulty === "medium"), `${seed}-m`),
    ...seededShuffle(preferred.filter((item) => item.difficulty === "hard"), `${seed}-h`),
  ];
  const picked: TopicBankQuestion[] = [];
  const used = new Set<string>();
  for (const item of mixed) {
    if (picked.length >= count) break;
    used.add(item.id);
    picked.push(item);
  }
  if (picked.length < count) {
    for (const item of seededShuffle(poolForBank(bankId), `${seed}-rest`)) {
      if (picked.length >= count) break;
      if (used.has(item.id)) continue;
      used.add(item.id);
      picked.push(item);
    }
  }
  return picked;
}

function attachPart(
  item: TopicBankQuestion,
  bank: TopicBank | undefined,
  part: ExamPartSpec,
  points: number,
  year?: number,
  session?: SessionKind,
): QuizQuestion {
  const lessonId = bank ? `bank:${bank.id}` : `bank:${part.bankId ?? "exam"}`;
  const styleYear = year ?? item.styleYear;
  const sessionKind = session ?? (item.session === "extraordinary" || item.session === "ordinary" ? item.session : undefined);
  const question = {
    id: item.id,
    lessonId: item.lessonId ?? lessonId,
    difficulty: bankDifficultyToLevel(item.difficulty),
    kind: "mcq" as const,
    prompt: item.stem,
    latex: item.latex,
    options: item.choices,
    correctIndex: item.answerIndex,
    steps: item.solutionSketch,
    solution: item.solutionSketch,
    points,
    partId: part.id,
    partLabel: part.arabicLabel,
    styleYear,
    sessionKind,
    catalogTopic: part.catalogTopic ?? (bank ? BANK_CATALOG_TOPIC[bank.id] : undefined),
    sourceKind: item.source?.kind ?? "generated-in-official-style",
    styleTag: styleYear && sessionKind ? `style:official-${styleYear}-${sessionKind}` : item.styleTag,
    verbatimPastPaper: false as const,
  };
  return question;
}

function paperId(certificate: CertificateBranch, year: number, session: SessionKind) {
  return `paper-${certificate}-${year}-${session}`;
}

function topicDrillId(certificate: CertificateBranch, topicId: string) {
  return `topic-${certificate}-${topicId}`;
}

function buildPaperMeta(certificate: CertificateBranch, year: number, session: SessionKind): ExamPackMeta {
  const cert = CERTIFICATE_META[certificate];
  const slots = PAPER_SLOTS[certificate];
  const sessionAr = sessionArabic(session);
  return {
    id: paperId(certificate, year, session),
    kind: "full-paper",
    certificate,
    year,
    session,
    title: `${cert.english} ${year} ${session === "ordinary" ? "Ordinary" : "Extraordinary"} (official style)`,
    arabicTitle: `${cert.arabic} · ${year} · دورة ${sessionAr}`,
    durationMinutes: cert.durationMinutes,
    passScore: 50,
    totalPoints: cert.totalPoints,
    parts: slots.map((slot) => ({
      id: slot.roman,
      roman: slot.roman,
      arabicLabel: slot.arabicLabel,
      englishLabel: slot.englishLabel,
      catalogTopic: slot.catalogTopic,
      bankId: slot.bankId,
      points: slot.points,
    })),
    disclaimer: PRACTICE_DISCLAIMER,
    styleTag: `style:official-${year}-${session}`,
    verbatimPastPaper: false,
    questionCount: slots.reduce((sum, slot) => sum + slot.count, 0),
  };
}

function banksForTopic(certificate: CertificateBranch, topicId: string): TopicBank[] {
  if (topicId === "differential" && certificate === "GS") {
    const bank = getTopicBank("g12-gs-differential");
    return bank ? [bank] : [];
  }
  return topicBanks.filter((bank) => {
    if (bank.certificate !== certificate) return false;
        const mapped = BANK_CATALOG_TOPIC[bank.id] ?? bank.topic.replace(/_/g, "-");
        return mapped === topicId || bank.topic === topicId || bank.topic.replace(/_/g, "-") === topicId;
  });
}

function buildTopicMeta(certificate: CertificateBranch, topicId: CatalogTopicId | string): ExamPackMeta | null {
  const banks = banksForTopic(certificate, topicId);
  if (!banks.length) return null;
  const topic = CATALOG_TOPICS.find((item) => item.id === topicId);
  const cert = CERTIFICATE_META[certificate];
  const count = banks.reduce((sum, bank) => sum + Math.min(12, bank.questions.length), 0);
  return {
    id: topicDrillId(certificate, topicId),
    kind: "topic-drill",
    certificate,
    topicId,
    title: `${cert.english} · ${topic?.english ?? topicId}`,
    arabicTitle: `${cert.arabic} · ${topic?.arabic ?? topicId}`,
    durationMinutes: Math.max(20, banks[0]?.contestMinutes ?? 25),
    passScore: 70,
    totalPoints: 0,
    parts: banks.map((bank, index) => ({
      id: String(index + 1),
      roman: ["I", "II", "III", "IV", "V"][index] ?? String(index + 1),
      arabicLabel: bank.arabicTitle,
      englishLabel: bank.title,
      catalogTopic: topicId,
      bankId: bank.id,
      points: 0,
    })),
    disclaimer: PRACTICE_DISCLAIMER,
    styleTag: "style:official-202x",
    verbatimPastPaper: false,
    questionCount: count,
  };
}

export function listCertificates(): CertificateBranch[] {
  return ["Brevet", "LS", "GS", "SE", "LH"];
}

export function listExamPacks(filters?: {
  certificate?: CertificateBranch | "";
  year?: number | "";
  session?: SessionKind | "";
  topic?: string;
}): ExamPackMeta[] {
  const packs: ExamPackMeta[] = [];
  for (const certificate of listCertificates()) {
    for (const year of EXAM_YEARS) {
      for (const session of EXAM_SESSIONS) {
        packs.push(buildPaperMeta(certificate, year, session.id));
      }
    }
    for (const topic of CATALOG_TOPICS) {
      const meta = buildTopicMeta(certificate, topic.id);
      if (meta) packs.push(meta);
    }
  }

  return packs.filter((pack) => {
    if (filters?.certificate && pack.certificate !== filters.certificate) return false;
    if (filters?.year && pack.year && pack.year !== Number(filters.year)) return false;
    if (filters?.session && pack.session && pack.session !== filters.session) return false;
    if (filters?.topic) {
      if (pack.kind === "topic-drill") return pack.topicId === filters.topic;
      return pack.parts.some((part) => part.catalogTopic === filters.topic);
    }
    return true;
  });
}

export function getExamPackMeta(id: string): ExamPackMeta | undefined {
  return listExamPacks().find((pack) => pack.id === id);
}

function assemblePaper(meta: ExamPackMeta): QuizQuestion[] {
  const slots = PAPER_SLOTS[meta.certificate];
  const questions: QuizQuestion[] = [];
  for (const slot of slots) {
    const bank = getTopicBank(slot.bankId);
    const picked = pickFromBank(slot.bankId, slot.count, `${meta.id}:${slot.roman}`, meta.year, meta.session);
    const weights = picked.map((item) => (item.difficulty === "hard" ? 3 : item.difficulty === "medium" ? 2 : 1));
    const points = distributePoints(picked.length, slot.points, weights);
    const part: ExamPartSpec = {
      id: slot.roman,
      roman: slot.roman,
      arabicLabel: slot.arabicLabel,
      englishLabel: slot.englishLabel,
      catalogTopic: slot.catalogTopic,
      bankId: slot.bankId,
      points: slot.points,
    };
    picked.forEach((item, index) => {
      questions.push(attachPart(item, bank, part, points[index] ?? 1, meta.year, meta.session));
    });
  }
  return questions;
}

function assembleTopicDrill(meta: ExamPackMeta): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  meta.parts.forEach((part) => {
    if (!part.bankId) return;
    const bank = getTopicBank(part.bankId);
    const pool =
      part.bankId === "g12-gs-differential"
        ? differentialPool()
        : (bank?.questions ?? []);
    const picked = pickFromBank(part.bankId, Math.min(8, Math.max(4, pool.length)), `${meta.id}:${part.id}`);
    const partTotal = picked.reduce((sum, item) => sum + (item.bareme ?? (item.difficulty === "hard" ? 3 : item.difficulty === "medium" ? 2 : 1)), 0);
    part.points = partTotal;
    picked.forEach((item) => {
      const pts = item.bareme ?? (item.difficulty === "hard" ? 3 : item.difficulty === "medium" ? 2 : 1);
      questions.push(attachPart(item, bank, part, pts));
    });
  });
  return questions;
}

function partsFromSlices(questions: QuizQuestion[], bank?: TopicBank): ExamPartSpec[] {
  if (!bank) {
    return [{ id: "I", roman: "I", arabicLabel: "الأسئلة", englishLabel: "Questions", points: questions.reduce((s, q) => s + (q.points ?? 1), 0) }];
  }
  const order = bank.slices.map((slice) => slice.id);
  const used = new Set(questions.map((item) => {
    const raw = bank.questions.find((row) => row.id === item.id);
    return raw?.slice ?? "";
  }));
  const parts: ExamPartSpec[] = [];
  order.forEach((sliceId, index) => {
    if (!used.has(sliceId)) return;
    const slice = bank.slices.find((row) => row.id === sliceId);
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII"][parts.length] ?? String(parts.length + 1);
    const ids = bank.questions.filter((row) => row.slice === sliceId).map((row) => row.id);
    const partQuestions = questions.filter((item) => ids.includes(item.id));
    if (!partQuestions.length) return;
    const part: ExamPartSpec = {
      id: roman,
      roman,
      arabicLabel: slice?.arabicTitle ?? sliceId,
      englishLabel: slice?.title ?? sliceId,
      bankId: bank.id,
      catalogTopic: BANK_CATALOG_TOPIC[bank.id],
      points: partQuestions.reduce((sum, item) => sum + (item.points ?? 1), 0),
    };
    partQuestions.forEach((item) => {
      item.partId = part.id;
      item.partLabel = part.arabicLabel;
    });
    parts.push(part);
    void index;
  });
  return parts.length ? parts : [{ id: "I", roman: "I", arabicLabel: bank.arabicTitle, englishLabel: bank.title, bankId: bank.id, points: questions.reduce((s, q) => s + (q.points ?? 1), 0) }];
}

export function assembleBankExam(bankId: string, mode: "contest" | "free"): AssembledExam | null {
  const bank = getTopicBank(bankId);
  if (!bank) return null;
  const questions = mode === "contest" ? contestFromBank(bankId) : quizQuestionsForBank(bankId);
  const enriched = questions.map((item) => ({
    ...item,
    points: item.points ?? 1,
    solution: item.solution ?? item.steps,
    verbatimPastPaper: false as const,
    catalogTopic: BANK_CATALOG_TOPIC[bank.id],
    sourceKind: item.sourceKind ?? "generated-in-official-style",
  }));
  const parts = partsFromSlices(enriched, bank);
  const totalPoints = enriched.reduce((sum, item) => sum + (item.points ?? 1), 0);
  return {
    pack: {
      id: `bank-${bank.id}-${mode}`,
      kind: mode === "contest" ? "bank-contest" : "bank-free",
      certificate: (["Brevet", "LS", "GS", "SE", "LH"] as const).includes(bank.certificate as CertificateBranch)
        ? (bank.certificate as CertificateBranch)
        : "LS",
      bankId: bank.id,
      topicId: BANK_CATALOG_TOPIC[bank.id],
      title: mode === "contest" ? `${bank.title} contest` : `${bank.title} bank`,
      arabicTitle: mode === "contest" ? `مسابقة ${bank.arabicTitle}` : `تدريب ${bank.arabicTitle}`,
      durationMinutes: mode === "contest" ? bank.contestMinutes : 0,
      passScore: bank.passScore,
      totalPoints,
      parts,
      disclaimer: PRACTICE_DISCLAIMER,
      styleTag: "style:official-202x",
      verbatimPastPaper: false,
      questionCount: enriched.length,
    },
    questions: enriched,
  };
}

export function assembleExam(packId: string): AssembledExam | null {
  const bankMatch = /^bank-(.+)-(contest|free)$/.exec(packId);
  if (bankMatch) {
    return assembleBankExam(bankMatch[1], bankMatch[2] as "contest" | "free");
  }

  const paperMatch = /^paper-(Brevet|LS|GS|SE|LH)-(\d{4})-(ordinary|extraordinary)$/.exec(packId);
  if (paperMatch) {
    const certificate = paperMatch[1] as CertificateBranch;
    const year = Number(paperMatch[2]);
    const session = paperMatch[3] as SessionKind;
    const pack = buildPaperMeta(certificate, year, session);
    const questions = assemblePaper(pack);
    return { pack: { ...pack, totalPoints: questions.reduce((s, q) => s + (q.points ?? 0), 0) }, questions };
  }

  const topicMatch = /^topic-(Brevet|LS|GS|SE|LH)-(.+)$/.exec(packId);
  if (topicMatch) {
    const pack = buildTopicMeta(topicMatch[1] as CertificateBranch, topicMatch[2]);
    if (!pack) return null;
    const questions = assembleTopicDrill(pack);
    return { pack: { ...pack, totalPoints: questions.reduce((s, q) => s + (q.points ?? 0), 0), questionCount: questions.length }, questions };
  }

  return null;
}

export function topicsAvailableFor(certificate: CertificateBranch): CatalogTopicId[] {
  return CATALOG_TOPICS.filter((topic) => banksForTopic(certificate, topic.id).length > 0).map((topic) => topic.id);
}

export function yearsForCatalog() {
  return EXAM_YEARS.map((year) => ({
    year,
    label: String(year),
    note: "تدريب بأسلوب النماذج الرسمية — ليست دورة منسوخة",
  }));
}
