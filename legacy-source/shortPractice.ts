import { examModels, type ExamModelQuestion } from "./examModels";
import { uploadedExamQuestionBank, type BankQuestion } from "./uploadedExamQuestionBank";
import { lessonReviewEntries } from "./lessonReviewLinks";

export type ShortPracticeQuestion = {
  id: string;
  skill: string;
  prompt: string;
  arabicPrompt: string;
  kind: "choice" | "typed";
  options: readonly string[];
  correctIndex: number;
  acceptedAnswers: readonly string[];
  explanation: string;
  arabicExplanation: string;
};

const aliases: Record<string, string[]> = {
  Functions: ["Functions", "Limits"],
  Limits: ["Limits"],
  Derivatives: ["Derivatives", "Derivative and extrema"],
  Integration: ["Integration", "Area from an integral"],
  Probability: ["Probability", "Probability complement", "Conditional probability"],
  Statistics: ["Statistics"],
  Percentages: ["Percentages", "Percent change", "Proportions"],
  "Linear models": ["Linear models", "Linear equations", "Coordinate geometry"],
  Sequences: ["Sequences", "Exponential modeling"],
  "Complex numbers": ["Complex numbers"],
  Trigonometry: ["Trigonometry"],
  "Exponential modeling": ["Exponential modeling"],
  "Random variables": ["Random variables"],
  Correlation: ["Correlation", "Statistics"],
  "Quadratic models": ["Quadratic models", "Quadratics", "Optimization"],
};

const toPracticeQuestion = (item: BankQuestion | ExamModelQuestion): ShortPracticeQuestion => ({
  id: item.id,
  skill: item.skill,
  prompt: item.prompt,
  arabicPrompt: item.arabicPrompt,
  kind: "choice",
  options: item.options,
  correctIndex: item.correctIndex,
  acceptedAnswers: [item.options[item.correctIndex]],
  explanation: item.explanation,
  arabicExplanation: item.arabicExplanation,
});

export function getSkillForPracticeSlug(slug: string) {
  return lessonReviewEntries.find((entry) => entry.slug === slug)?.skill ?? slug;
}

export function getShortPracticeQuestions(skill: string, limit = 3): ShortPracticeQuestion[] {
  const allowed = new Set(aliases[skill] ?? [skill]);
  const bankMatches = uploadedExamQuestionBank.filter((item) => allowed.has(item.skill)).map(toPracticeQuestion);
  const modelMatches = examModels.flatMap((model) => model.questions).filter((item) => allowed.has(item.skill)).map(toPracticeQuestion);
  const unique = [...bankMatches, ...modelMatches].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  return unique.slice(0, limit).map((item, index) => index === Math.min(limit, 3) - 1 ? { ...item, kind: "typed" as const, options: [], acceptedAnswers: [item.options[item.correctIndex]] } : item);
}
