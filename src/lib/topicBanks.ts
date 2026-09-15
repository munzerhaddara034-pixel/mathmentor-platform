import type { Difficulty, GradeTrack, QuizQuestion, SessionKind } from "./types";
import lsFunctionsBankJson from "../../content/banks/g12-ls/functions.json";
import lsSpaceBankJson from "../../content/banks/g12-ls/space-geometry.json";
import lsProbabilityBankJson from "../../content/banks/g12-ls/probability.json";
import lsMcqBankJson from "../../content/banks/g12-ls/mcq-mixed.json";
import lsSequencesBankJson from "../../content/banks/g12-ls/sequences.json";
import seFunctionsBankJson from "../../content/banks/g12-se/functions.json";
import seProbabilityBankJson from "../../content/banks/g12-se/probability.json";
import seMcqBankJson from "../../content/banks/g12-se/mcq-mixed.json";
import seSequencesBankJson from "../../content/banks/g12-se/sequences.json";
import gsFunctionsBankJson from "../../content/banks/g12-gs/functions.json";
import gsSpaceBankJson from "../../content/banks/g12-gs/space-geometry.json";
import gsProbabilityBankJson from "../../content/banks/g12-gs/probability.json";
import gsComplexBankJson from "../../content/banks/g12-gs/complex.json";
import gsMcqBankJson from "../../content/banks/g12-gs/mcq-mixed.json";
import gsSequencesBankJson from "../../content/banks/g12-gs/sequences.json";
import gsDifferentialBankJson from "../../content/banks/g12-gs/differential.json";
import numbersBankJson from "../../content/banks/brevet/numbers.json";
import algebraBankJson from "../../content/banks/brevet/algebra.json";
import wordProblemsBankJson from "../../content/banks/brevet/word_problems.json";
import geometryBankJson from "../../content/banks/brevet/geometry.json";
import coordinateBankJson from "../../content/banks/brevet/coordinate.json";
import lhFunctionsBankJson from "../../content/banks/g12-lh/functions.json";
import lhSequencesBankJson from "../../content/banks/g12-lh/sequences.json";
import lhProbabilityBankJson from "../../content/banks/g12-lh/probability.json";
import lhAnalyticBankJson from "../../content/banks/g12-lh/analytic-geometry.json";

export type BankDifficulty = "easy" | "medium" | "hard";

export type TopicBankQuestion = {
  id: string;
  slice: string;
  difficulty: BankDifficulty;
  source: {
    kind: string;
    models: string[];
    tag?: string;
    note?: string;
  };
  stem: string;
  latex?: string;
  choices: string[];
  answerIndex: number;
  answer: string;
  solutionSketch: string[];
  lessonId?: string;
  /** Official-style barème (marks). */
  bareme?: number;
  points?: number;
  styleYear?: number;
  session?: SessionKind | string;
  styleTag?: string;
  verbatimPastPaper?: boolean;
};

export type TopicBankSlice = {
  id: string;
  title: string;
  arabicTitle: string;
  note?: string;
};

/** Typical Lebanese Grade 12 LS paper: I mixed MCQ, II space geometry, III probability, IV functions analysis. */
export type ContestPaperTopic = {
  id: string;
  file: string | null;
  title: string;
  arabicTitle?: string;
  note?: string;
  implemented?: boolean;
};

export type TopicBank = {
  id: string;
  track: GradeTrack | string;
  certificate: string;
  topic: string;
  title: string;
  arabicTitle: string;
  lessonId?: string;
  contestMinutes: number;
  passScore: number;
  sourceModels: string[];
  styleNote?: string;
  verbatimPastPaper?: boolean;
  slices: TopicBankSlice[];
  order?: string;
  contestTopics?: ContestPaperTopic[];
  nextTopicFiles?: string[];
  questions: TopicBankQuestion[];
};

export const topicBanks: TopicBank[] = [
  lsMcqBankJson as TopicBank,
  lsSpaceBankJson as TopicBank,
  lsProbabilityBankJson as TopicBank,
  lsFunctionsBankJson as TopicBank,
  lsSequencesBankJson as TopicBank,
  seMcqBankJson as TopicBank,
  seProbabilityBankJson as TopicBank,
  seFunctionsBankJson as TopicBank,
  seSequencesBankJson as TopicBank,
  gsMcqBankJson as TopicBank,
  gsSpaceBankJson as TopicBank,
  gsProbabilityBankJson as TopicBank,
  gsComplexBankJson as TopicBank,
  gsFunctionsBankJson as TopicBank,
  gsSequencesBankJson as TopicBank,
  gsDifferentialBankJson as TopicBank,
  numbersBankJson as TopicBank,
  algebraBankJson as TopicBank,
  wordProblemsBankJson as TopicBank,
  geometryBankJson as TopicBank,
  coordinateBankJson as TopicBank,
  lhFunctionsBankJson as TopicBank,
  lhSequencesBankJson as TopicBank,
  lhProbabilityBankJson as TopicBank,
  lhAnalyticBankJson as TopicBank,
];

export function getTopicBank(id: string): TopicBank | undefined {
  return topicBanks.find((bank) => bank.id === id);
}

export function bankDifficultyToLevel(difficulty: BankDifficulty): Difficulty {
  if (difficulty === "easy") return 1;
  if (difficulty === "medium") return 2;
  return 4;
}

export function defaultBareme(difficulty: BankDifficulty): number {
  if (difficulty === "easy") return 1;
  if (difficulty === "medium") return 2;
  return 3;
}

export function bankItemToQuizQuestion(item: TopicBankQuestion, lessonId: string): QuizQuestion {
  const points = item.bareme ?? item.points ?? defaultBareme(item.difficulty);
  const session = item.session === "extraordinary" || item.session === "ordinary" ? item.session : undefined;
  return {
    id: item.id,
    lessonId: item.lessonId ?? lessonId,
    difficulty: bankDifficultyToLevel(item.difficulty),
    kind: "mcq",
    prompt: item.stem,
    latex: item.latex,
    options: item.choices,
    correctIndex: item.answerIndex,
    steps: item.solutionSketch,
    solution: item.solutionSketch,
    points,
    styleYear: item.styleYear,
    sessionKind: session,
    catalogTopic: undefined,
    sourceKind: item.source?.kind,
    styleTag: item.styleTag ?? (item.styleYear && session ? `style:official-${item.styleYear}-${session}` : undefined),
    verbatimPastPaper: item.verbatimPastPaper === true,
  };
}

export function quizQuestionsForBank(bankId: string): QuizQuestion[] {
  const bank = getTopicBank(bankId);
  if (!bank) return [];
  const lessonId = `bank:${bank.id}`;
  return bank.questions.map((item) => bankItemToQuizQuestion(item, lessonId));
}

export function quizQuestionsForSlice(bankId: string, slice: string, lessonId?: string): QuizQuestion[] {
  const bank = getTopicBank(bankId);
  if (!bank) return [];
  const fallback = lessonId ?? bank.lessonId ?? `bank:${bank.id}`;
  return bank.questions
    .filter((item) => item.slice === slice)
    .map((item) => bankItemToQuizQuestion(item, fallback));
}

/** Keep easy → medium → hard. Within a band, round-robin slices so Limits stays first and later Problem-IV slices still appear. */
export function contestFromBank(
  bankId: string,
  counts: { easy: number; medium: number; hard: number } = { easy: 5, medium: 7, hard: 4 },
): QuizQuestion[] {
  const bank = getTopicBank(bankId);
  if (!bank) return [];
  const lessonId = `bank:${bank.id}`;
  const sliceIds = bank.slices.map((slice) => slice.id);
  const pick = (band: BankDifficulty, n: number) => {
    const pool = bank.questions.filter((item) => item.difficulty === band);
    const used = new Set<string>();
    const picked: TopicBankQuestion[] = [];
    let turn = 0;
    while (picked.length < n && picked.length < pool.length && turn < n * sliceIds.length + pool.length) {
      const slice = sliceIds[turn % sliceIds.length];
      const next = pool.find((item) => item.slice === slice && !used.has(item.id));
      turn += 1;
      if (!next) continue;
      used.add(next.id);
      picked.push(next);
    }
    for (const item of pool) {
      if (picked.length >= n) break;
      if (!used.has(item.id)) {
        used.add(item.id);
        picked.push(item);
      }
    }
    return picked;
  };
  return [...pick("easy", counts.easy), ...pick("medium", counts.medium), ...pick("hard", counts.hard)].map((item) =>
    bankItemToQuizQuestion(item, lessonId),
  );
}

export function listTopicBankCards() {
  return topicBanks.map((bank) => ({
    id: bank.id,
    title: bank.title,
    arabicTitle: bank.arabicTitle,
    certificate: bank.certificate,
    track: bank.track,
    questionCount: bank.questions.length,
    contestMinutes: bank.contestMinutes,
    passScore: bank.passScore,
    slices: bank.slices,
    contestTopics: bank.contestTopics ?? [],
    styleNote: bank.styleNote,
    topic: bank.topic,
  }));
}

const CERTIFICATE_ORDER: Record<string, string[]> = {
  LS: [
    "g12-ls-mcq-mixed",
    "g12-ls-space-geometry",
    "g12-ls-probability",
    "g12-ls-functions",
    "g12-ls-sequences",
  ],
  SE: ["g12-se-mcq-mixed", "g12-se-probability", "g12-se-functions", "g12-se-sequences"],
  GS: [
    "g12-gs-mcq-mixed",
    "g12-gs-space-geometry",
    "g12-gs-probability",
    "g12-gs-complex",
    "g12-gs-functions",
    "g12-gs-sequences",
    "g12-gs-differential",
  ],
  Brevet: [
    "brevet-numbers",
    "brevet-algebra",
    "brevet-word-problems",
    "brevet-geometry",
    "brevet-coordinate",
  ],
  LH: ["g12-lh-functions", "g12-lh-sequences", "g12-lh-probability", "g12-lh-analytic-geometry"],
};

function orderCards(cards: ReturnType<typeof listTopicBankCards>, ids: string[]) {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const ordered = ids.map((id) => byId.get(id)).filter((card): card is NonNullable<typeof card> => Boolean(card));
  const leftover = cards.filter((card) => !ids.includes(card.id));
  return [...ordered, ...leftover];
}

export function groupTopicBankCards() {
  const cards = listTopicBankCards();
  return {
    ls: orderCards(
      cards.filter((card) => card.certificate === "LS"),
      CERTIFICATE_ORDER.LS,
    ),
    se: orderCards(
      cards.filter((card) => card.certificate === "SE"),
      CERTIFICATE_ORDER.SE,
    ),
    gs: orderCards(
      cards.filter((card) => card.certificate === "GS"),
      CERTIFICATE_ORDER.GS,
    ),
    brevet: orderCards(
      cards.filter((card) => card.certificate === "Brevet"),
      CERTIFICATE_ORDER.Brevet,
    ),
    lh: orderCards(
      cards.filter((card) => card.certificate === "LH"),
      CERTIFICATE_ORDER.LH,
    ),
  };
}

/** Merge GS functions DE slice with the dedicated differential scaffold. */
export function differentialPool(): TopicBankQuestion[] {
  const extra = getTopicBank("g12-gs-differential")?.questions ?? [];
  const fromFunctions = (getTopicBank("g12-gs-functions")?.questions ?? []).filter((item) => item.slice === "de");
  const fromMixed = (getTopicBank("g12-gs-mcq-mixed")?.questions ?? []).filter((item) => item.slice === "de");
  const seen = new Set<string>();
  const merged: TopicBankQuestion[] = [];
  for (const item of [...extra, ...fromFunctions, ...fromMixed]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
