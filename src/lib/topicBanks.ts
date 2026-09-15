import type { Difficulty, GradeTrack, QuizQuestion } from "./types";
import certificateCatalogJson from "../../content/banks/certificates.json";
import functionsBankJson from "../../content/banks/g12-ls/functions.json";
import numbersBankJson from "../../content/banks/brevet/numbers.json";
import algebraBankJson from "../../content/banks/brevet/algebra.json";
import wordProblemsBankJson from "../../content/banks/brevet/word_problems.json";
import geometryBankJson from "../../content/banks/brevet/geometry.json";
import coordinateBankJson from "../../content/banks/brevet/coordinate.json";

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
  slices: TopicBankSlice[];
  order?: string;
  contestTopics?: ContestPaperTopic[];
  nextTopicFiles?: string[];
  questions: TopicBankQuestion[];
};

export type CertificateTopicSlot = {
  id: string;
  file: string | null;
  title: string;
  arabicTitle?: string;
  note?: string;
};

export type CertificateBranchMeta = {
  id: string;
  certificate: string;
  track: string;
  title: string;
  arabicTitle: string;
  heading: string;
  note: string;
  sourcePack: string;
  folder: string;
  topics: CertificateTopicSlot[];
};

/**
 * Live banks. Sibling agents: import the new JSON and append it here with
 * `certificate` set to Brevet | LS | SE | GS. The practice hub groups by that field.
 */
export const topicBanks: TopicBank[] = [
  functionsBankJson as TopicBank,
  numbersBankJson as TopicBank,
  algebraBankJson as TopicBank,
  wordProblemsBankJson as TopicBank,
  geometryBankJson as TopicBank,
  coordinateBankJson as TopicBank,
];

const certificateCatalog = certificateCatalogJson as { branches: CertificateBranchMeta[] };

export function getTopicBank(id: string): TopicBank | undefined {
  return topicBanks.find((bank) => bank.id === id);
}

export function bankDifficultyToLevel(difficulty: BankDifficulty): Difficulty {
  if (difficulty === "easy") return 1;
  if (difficulty === "medium") return 2;
  return 4;
}

export function bankItemToQuizQuestion(item: TopicBankQuestion, lessonId: string): QuizQuestion {
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

export type TopicBankCard = ReturnType<typeof listTopicBankCards>[number];

function topicIsLive(card: TopicBankCard, topicId: string) {
  return card.topic === topicId || card.id === topicId || card.id.endsWith(`-${topicId}`) || card.id.includes(`-${topicId}`);
}

export function listCertificateBranches() {
  const cards = listTopicBankCards();
  const byCertificate = new Map<string, TopicBankCard[]>();
  for (const card of cards) {
    const list = byCertificate.get(card.certificate) ?? [];
    list.push(card);
    byCertificate.set(card.certificate, list);
  }

  const seen = new Set<string>();
  const branches = certificateCatalog.branches.map((branch) => {
    seen.add(branch.certificate);
    const live = byCertificate.get(branch.certificate) ?? [];
    const topics = branch.topics.map((topic) => ({
      ...topic,
      implemented: live.some((card) => topicIsLive(card, topic.id)),
    }));
    return { ...branch, topics, cards: live };
  });

  for (const [certificate, live] of byCertificate) {
    if (seen.has(certificate)) continue;
    branches.push({
      id: certificate.toLowerCase(),
      certificate,
      track: String(live[0]?.track ?? "grade-12"),
      title: certificate,
      arabicTitle: certificate,
      heading: certificate,
      note: "",
      sourcePack: "",
      folder: "",
      topics: [],
      cards: live,
    });
  }
  return branches;
}

export function groupTopicBankCards() {
  const branches = listCertificateBranches();
  const cardsOf = (certificate: string) => branches.find((branch) => branch.certificate === certificate)?.cards ?? [];
  return {
    branches,
    ls: cardsOf("LS"),
    brevet: cardsOf("Brevet"),
    se: cardsOf("SE"),
    gs: cardsOf("GS"),
  };
}
