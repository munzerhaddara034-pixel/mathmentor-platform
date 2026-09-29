import { coerceBilingual, type Bilingual } from "./i18n";
import { actionAbsoluteTime, type CanvasAction, type LessonTimeline } from "./timeline";

export type QuizChoice = { id: string; text: Bilingual };

export type QuizMcq = {
  id: string;
  at: number;
  question: Bilingual;
  choices: QuizChoice[];
  correctId: string;
  explanation?: Bilingual;
};

export function isQuizAction(action: CanvasAction) {
  return action.type === "quiz_mcq";
}

function asChoice(item: unknown, index: number): QuizChoice {
  const fallbackId = String.fromCharCode(97 + index);
  if (typeof item === "string") {
    const text = item.trim();
    return { id: fallbackId, text: { en: text, fr: text } };
  }
  if (!item || typeof item !== "object") {
    return { id: fallbackId, text: { en: `Choice ${index + 1}`, fr: `Choix ${index + 1}` } };
  }
  const rec = item as Record<string, unknown>;
  const text =
    coerceBilingual(rec.text) ??
    coerceBilingual(rec.label) ??
    coerceBilingual(rec.en ? rec : undefined) ??
    (typeof rec.value === "string" ? { en: rec.value, fr: rec.value } : undefined);
  return {
    id: typeof rec.id === "string" && rec.id ? rec.id : fallbackId,
    text: text ?? { en: `Choice ${index + 1}`, fr: `Choix ${index + 1}` },
  };
}

export function parseQuizAction(action: CanvasAction, abs = action.at): QuizMcq | null {
  if (action.type !== "quiz_mcq") return null;
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  const question = coerceBilingual(payload.question) ?? coerceBilingual(payload.prompt);
  const rawChoices = Array.isArray(payload.choices)
    ? payload.choices
    : Array.isArray(payload.options)
      ? payload.options
      : [];
  const choices = rawChoices.map(asChoice);
  const correctRaw = payload.correctId ?? payload.answer ?? payload.correct;
  const correctId = typeof correctRaw === "string" ? correctRaw : typeof correctRaw === "number" ? String(correctRaw) : "";
  if (!question || choices.length < 2 || !correctId) return null;
  const stem = question.en.slice(0, 32).replace(/\s+/g, "-");
  return {
    id: typeof payload.id === "string" && payload.id ? payload.id : `quiz-${abs}-${stem}`,
    at: abs,
    question,
    choices,
    correctId,
    explanation: coerceBilingual(payload.explanation) ?? coerceBilingual(payload.solution),
  };
}

export function listQuizEvents(timeline: LessonTimeline): QuizMcq[] {
  const out: QuizMcq[] = [];
  for (const segment of timeline.segments) {
    for (const action of segment.canvas.actions) {
      const quiz = parseQuizAction(action, actionAbsoluteTime(segment, action));
      if (quiz) out.push(quiz);
    }
  }
  for (const action of timeline.events ?? []) {
    const quiz = parseQuizAction(action, action.at);
    if (quiz) out.push(quiz);
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

/** Earliest unanswered quiz whose timestamp has been reached (or passed). */
export function blockingQuizAt(
  timeline: LessonTimeline,
  timeSec: number,
  resolvedIds: Iterable<string>,
): QuizMcq | null {
  const resolved = new Set(resolvedIds);
  for (const quiz of listQuizEvents(timeline)) {
    if (resolved.has(quiz.id)) continue;
    if (timeSec + 0.05 >= quiz.at) return quiz;
  }
  return null;
}

export function firstUnresolvedQuiz(timeline: LessonTimeline, resolvedIds: Iterable<string>): QuizMcq | null {
  const resolved = new Set(resolvedIds);
  return listQuizEvents(timeline).find((quiz) => !resolved.has(quiz.id)) ?? null;
}
