import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { demoSolve } from "@/lib/solver/demoSolver";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { formatLebaneseEquation, spokenMathToLebaneseLatex } from "@/lib/math/lebaneseEquationFormat";
import { extractLatexHints, spokenMathToPlain } from "./phrases";
import type { LatexStep, VoiceTranscript } from "./types";

export const DEMO_DICTATION_AR =
  "ادرس الدالة إف إكس تساوي إكس مربع ناقص خمسة إكس زائد ستة. مجموعة التعريف. نهاية عند الزائد إنفينيتي. ديريفاتيف. جدول التغيرات. الجواب في إطار.";

export const DEMO_DICTATION_EN =
  "Study the function f of x equals x squared minus five x plus six. Domain. Limit as x goes to plus infinity. Derivative. Table of variations. Box the answer.";

export const DEMO_DICTATION_EXP_AR =
  "ادرس الدالة إف إكس تساوي إكس ناقص واحد في إي أس إكس. مجموعة التعريف كل الأعداد الحقيقية. نهاية عند الناقص إنفينيتي صفر. ديريفاتيف إكس إي أس إكس.";

export const DEMO_DICTATION_FRAC_AR = "واحد على إكس. إكس سكوير. جذر إكس.";

export type DemoDictation = {
  id: string;
  labelAr: string;
  labelEn: string;
  transcript: string;
  language: LessonLanguage;
  track: CertificateTrack;
};

export const DEMO_DICTATIONS: DemoDictation[] = [
  {
    id: "quad-ar",
    labelAr: "إكس مربع − ٥إكس + ٦ (عربي)",
    labelEn: "x² − 5x + 6 (Arabic dictation)",
    transcript: DEMO_DICTATION_AR,
    language: "ar",
    track: "brevet",
  },
  {
    id: "quad-en",
    labelAr: "x² − 5x + 6 (إنجليزي)",
    labelEn: "x² − 5x + 6 (English dictation)",
    transcript: DEMO_DICTATION_EN,
    language: "en",
    track: "brevet",
  },
  {
    id: "exp-ar",
    labelAr: "إف إكس = (إكس−١) إي أس إكس",
    labelEn: "f(x)=(x−1)eˣ (Arabic)",
    transcript: DEMO_DICTATION_EXP_AR,
    language: "ar",
    track: "ls",
  },
  {
    id: "frac-ar",
    labelAr: "واحد على إكس · إكس سكوير",
    labelEn: "1/x and x squared (Arabic)",
    transcript: DEMO_DICTATION_FRAC_AR,
    language: "ar",
    track: "ls",
  },
];

export function defaultDemoDictation(language: LessonLanguage = "ar"): DemoDictation {
  if (language === "en") return DEMO_DICTATIONS[1];
  if (language === "ar") return DEMO_DICTATIONS[0];
  return DEMO_DICTATIONS[0];
}

export function demoTranscriptFromStub(opts?: {
  transcript?: string;
  language?: LessonLanguage;
  durationSec?: number;
}): VoiceTranscript {
  const language = opts?.language ?? "ar";
  const stub = opts?.transcript?.trim() || defaultDemoDictation(language).transcript;
  return {
    text: stub,
    formattedLatex: spokenMathToLebaneseLatex(stub),
    language,
    durationSec: opts?.durationSec ?? 48,
    segments: equalSegments(stub, opts?.durationSec ?? 48),
    source: "demo",
    warning: `Demo speech-to-text (no OPENAI_API_KEY). Sample dictation for ${INSTRUCTOR_EN} / ${INSTRUCTOR_AR}.`,
  };
}

export function equalSegments(text: string, durationSec: number): Array<{ start: number; end: number; text: string }> {
  const chunks = text
    .split(/[.。؟!]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const n = Math.max(1, chunks.length);
  const slice = durationSec / n;
  return chunks.map((chunk, index) => ({
    start: Math.round(index * slice * 100) / 100,
    end: Math.round(Math.min(durationSec, (index + 1) * slice) * 100) / 100,
    text: chunk,
  }));
}

export function questionFromTranscript(transcript: string) {
  const plain = spokenMathToPlain(transcript);
  const compact = plain.replace(/\s+/g, "");
  if (/x\^\{?2\}/.test(plain) && /(5|five|خمسة)/i.test(plain) && /(6|six|ستة)/i.test(plain)) {
    return "Solve x^2 - 5x + 6 = 0";
  }
  if (/x\^\{?2\}\s*(minus|-)\s*5\s*x\s*(plus|\+)\s*6|x\^\{?2\}-5x\+6/i.test(compact)) {
    return "Solve x^2 - 5x + 6 = 0";
  }
  if (/\(x-1\)e\^x|x-1.*e\^x|\(x\s*-?\s*1\).*e\^x/i.test(compact) || (/e\^x/.test(plain) && /x\s*minus\s*1|x-1/.test(plain))) {
    return "Let f(x)=(x-1)e^x. Find f'(x) and the minimum.";
  }
  if (/lim.*\+?inf/i.test(plain) && /3x\^2/i.test(plain)) {
    return "Compute lim x->inf (3x^2 + 1)/(x^2 - 2)";
  }
  if (/(\\frac\{1\}\{x\}|1\s*\/\s*x)/.test(plain) && /x\^\{?2\}/.test(plain)) {
    return "Write \\frac{1}{x}, x^{2}, and \\sqrt{x}.";
  }
  if (/f\(x\)|Study the function|x\^2/i.test(plain)) {
    return plain.slice(0, 280) || "Solve x^2 - 5x + 6 = 0";
  }
  return plain || "Solve x^2 - 5x + 6 = 0";
}

export function demoParseTranscript(transcript: string, language: LessonLanguage = "ar", track: CertificateTrack = "ls") {
  const question = questionFromTranscript(transcript);
  const solution = demoSolve({ question, language, track });
  const hints = extractLatexHints(transcript);
  const latexSteps: LatexStep[] = solution.steps.map((step, index) => ({
    title: step.title,
    titleFr: step.titleFr,
    titleAr: step.titleAr,
    latex: formatLebaneseEquation(step.latex || hints[index]?.latex || ""),
    examVerbEn: step.examVerbEn,
    examVerbFr: step.examVerbFr,
    theoremEn: step.theoremEn,
    theoremFr: step.theoremFr,
    theoremAr: step.theoremAr,
    explanationEn: step.explanationEn,
    explanationFr: step.explanationFr,
    explanationAr: step.explanationAr,
    boxed: step.boxed,
  }));
  if (hints.length) {
    const spokenLatex = formatLebaneseEquation(hints.map((hint) => hint.latex).join("\\quad "));
    if (latexSteps[0]?.latex !== spokenLatex) {
      latexSteps.unshift({
        title: "Spoken math → LaTeX",
        titleFr: "Oral → LaTeX",
        titleAr: "من الكلام إلى لاتخ",
        latex: spokenLatex,
        explanationEn: `Heard: ${hints.map((hint) => `${hint.spoken} → $${hint.latex}$`).join("; ")}.`,
        explanationFr: `Entendu : ${hints.map((hint) => `${hint.spoken} → $${hint.latex}$`).join("; ")}.`,
        explanationAr: `سُمع: ${hints.map((hint) => `${hint.spoken} ← ${hint.latex}`).join("؛ ")}.`,
      });
    }
  }
  solution.warning =
    solution.warning ||
    "Demo speech-to-LaTeX (no GEMINI_API_KEY / OPENAI_API_KEY). Lebanese official sequence from the local solver.";
  return { question, solution, latexSteps, hints };
}
