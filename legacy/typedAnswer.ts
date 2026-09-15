export type TypedPractice = {
  question: string;
  arabicQuestion: string;
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  arabicExplanation: string;
  difficulty: "guided" | "standard" | "challenge";
  placeholder: string;
};

export function normalizeTypedAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[,$€£%]/g, "")
    .replace(/\\/g, "")
    .replace(/\s+/g, "")
    .replace(/\^\{([^}]+)\}/g, "^$1")
    .replace(/[×·]/g, "*")
    .replace(/−/g, "-");
}

export function isTypedAnswerCorrect(value: string, answer: TypedPractice): boolean {
  const normalized = normalizeTypedAnswer(value);
  if (!normalized) return false;
  const accepted = [answer.answer, ...answer.acceptedAnswers].map(normalizeTypedAnswer);
  if (accepted.includes(normalized)) return true;
  const numericValue = Number(normalized);
  if (!Number.isNaN(numericValue) && accepted.every((item) => item !== "")) {
    const numericAccepted = accepted.map(Number).filter((item) => !Number.isNaN(item));
    return numericAccepted.some((item) => Math.abs(item - numericValue) < 0.0001);
  }
  return false;
}
