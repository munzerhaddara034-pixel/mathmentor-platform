import { z } from "zod";
import { OFFICIAL_METHODOLOGY_PROMPT, INSTRUCTOR_EN, INSTRUCTOR_AR, ACADEMY_LINE } from "@/lib/pedagogy/lebanese";
import { assembleSolution } from "@/lib/solver/assemble";
import { geminiApiKey, openaiSolverKey } from "@/lib/solver/llm";
import type { MathSolution, SolverStep, StudyKind } from "@/lib/solver/types";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { demoParseTranscript } from "./demo";
import { extractLatexHints, spokenMathToPlain } from "./phrases";
import type { LatexStep, VoiceParseSource } from "./types";

const parseJsonSchema = z.object({
  question: z.string().optional(),
  latexDraft: z.string().optional(),
  summary: z.string().optional(),
  examTip: z
    .object({
      en: z.string(),
      fr: z.string().optional(),
      ar: z.string().optional(),
    })
    .optional(),
  studyKind: z
    .enum(["real_function", "geometry", "complex", "probability", "algebra", "limits", "general"])
    .optional(),
  given: z
    .object({
      latex: z.string(),
      aimEn: z.string(),
      aimFr: z.string().optional(),
      aimAr: z.string(),
    })
    .optional(),
  finalAnswer: z.string().optional(),
  finalAnswerLatex: z.string().optional(),
  topic: z.string().optional(),
  topicTag: z.string().optional(),
  track: z.string().optional(),
  graph: z
    .object({
      fn: z.string(),
      domain: z.tuple([z.number(), z.number()]).optional(),
      highlights: z.unknown().optional(),
    })
    .optional(),
  trap: z
    .object({
      wrong: z.string(),
      wrongFr: z.string(),
      correction: z.string(),
      correctionFr: z.string(),
      latex: z.string(),
    })
    .optional(),
  latexSteps: z
    .array(
      z.object({
        title: z.string(),
        titleFr: z.string().optional(),
        titleAr: z.string().optional(),
        latex: z.string(),
        examVerbEn: z.string().optional(),
        examVerbFr: z.string().optional(),
        theoremEn: z.string().optional(),
        theoremFr: z.string().optional(),
        theoremAr: z.string().optional(),
        explanationEn: z.string(),
        explanationFr: z.string(),
        explanationAr: z.string().optional(),
        boxed: z.boolean().optional(),
      }),
    )
    .optional(),
  steps: z
    .array(
      z.object({
        title: z.string(),
        titleFr: z.string().optional(),
        titleAr: z.string().optional(),
        latex: z.string(),
        examVerbEn: z.string().optional(),
        examVerbFr: z.string().optional(),
        theoremEn: z.string().optional(),
        theoremFr: z.string().optional(),
        theoremAr: z.string().optional(),
        explanationEn: z.string(),
        explanationFr: z.string(),
        explanationAr: z.string().optional(),
        boxed: z.boolean().optional(),
      }),
    )
    .optional(),
});

const SPEECH_PROMPT = `${OFFICIAL_METHODOLOGY_PROMPT}

You are converting a TEACHER'S SPOKEN MATH DICTATION (Arabic Lebanese dialect mixed with English/French exam verbs) into a full official Lebanese solution.

Convert spoken phrases to pure LaTeX. Canonical examples:
- «إكس مربع» / «إكس سكوير» / "x squared" → $x^{2}$
- «واحد على إكس» / "one over x" → $\\frac{1}{x}$ (NEVER 1/x)
- «نهاية عند الزائد إنفينيتي» / "limit as x goes to plus infinity" → $\\lim\\limits_{x \\to +\\infty}$
- «ديريفاتيف» / "derivative" / «إف فتحة» → $f'(x)$
- «جذر إكس» / "sqrt x" → $\\sqrt{x}$ (NEVER the letters sqrt)
Never write Unicode mini-math. Never slash fractions. Never a visible caret. Limits under the operator; integral bounds above/below.

Return ONE JSON object:
{
  "question": "cleaned problem statement",
  "latexDraft": "main given in LaTeX",
  "summary": string,
  "examTip": { "en": string, "fr": string, "ar": string },
  "studyKind": "real_function" | "geometry" | "complex" | "probability" | "algebra" | "limits" | "general",
  "given": { "latex": string, "aimEn": string, "aimFr": string, "aimAr": string },
  "finalAnswer": string,
  "finalAnswerLatex": string,
  "topic": string,
  "topicTag": string,
  "track": "brevet" | "ls" | "se" | "gs" | "lh" | "sat",
  "latexSteps": [
    {
      "title": string,
      "titleFr": string,
      "titleAr": string,
      "examVerbEn": "Show that" | "Deduce" | "Calculate" | "Interpret geometrically" | "Justify" | "Determine" | "Solve",
      "examVerbFr": "Montrer que" | "En déduire" | "Calculer" | "Interpréter géométriquement" | "Justifier" | "Déterminer" | "Résoudre",
      "latex": string,
      "theoremEn": string,
      "theoremFr": string,
      "theoremAr": string,
      "explanationEn": string,
      "explanationFr": string,
      "explanationAr": string,
      "boxed": boolean
    }
  ],
  "graph": { "fn": "JS expression in x", "domain": [number, number], "highlights": { "roots": [[x,y]], "extrema": [[x,y]], "asymptotes": [{"x": number} or {"y": number}] } },
  "trap": { "wrong": string, "wrongFr": string, "correction": string, "correctionFr": string, "latex": string }
}

Follow the official sequence: Key Idea → Domain D_f → Limits/Asymptotes → Derivative/Variation table → Points/Graph → Boxed answers → Common pitfalls.
Instructor is always ${INSTRUCTOR_EN} (${INSTRUCTOR_AR}). Academy: ${ACADEMY_LINE}.`;

function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Speech parser did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function geminiSpeechModels() {
  const pinned = process.env.GEMINI_VOICE_MODEL?.trim() || process.env.GEMINI_MODEL?.trim();
  return pinned
    ? [pinned]
    : ["gemini-1.5-pro", "gemini-1.5-pro-latest", "gemini-2.0-flash", "gemini-2.5-flash"];
}

function toLatexSteps(parsed: z.infer<typeof parseJsonSchema>): LatexStep[] {
  const rows = parsed.latexSteps?.length ? parsed.latexSteps : parsed.steps ?? [];
  return rows.map((step) => ({
    title: step.title,
    titleFr: step.titleFr,
    titleAr: step.titleAr,
    latex: formatLebaneseEquation(step.latex),
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
}

function solutionFromParsed(
  parsed: z.infer<typeof parseJsonSchema>,
  transcript: string,
  language: LessonLanguage,
  track: CertificateTrack,
  source: MathSolution["source"],
): { question: string; latexDraft: string; latexSteps: LatexStep[]; solution: MathSolution } {
  const question = parsed.question?.trim() || spokenMathToPlain(transcript) || transcript;
  const latexSteps = toLatexSteps(parsed);
  const steps: SolverStep[] = latexSteps.map((step) => ({
    title: step.title,
    titleFr: step.titleFr,
    titleAr: step.titleAr,
    examVerbEn: step.examVerbEn,
    examVerbFr: step.examVerbFr,
    latex: step.latex,
    theoremEn: step.theoremEn,
    theoremFr: step.theoremFr,
    theoremAr: step.theoremAr,
    explanationEn: step.explanationEn,
    explanationFr: step.explanationFr,
    explanationAr: step.explanationAr,
    boxed: step.boxed,
  }));
  const solution = assembleSolution({
    question,
    summary: parsed.summary || parsed.given?.aimEn || "Spoken Lebanese-curriculum solution.",
    finalAnswer: parsed.finalAnswer || parsed.finalAnswerLatex || "",
    finalAnswerLatex: parsed.finalAnswerLatex || parsed.finalAnswer || "",
    steps,
    graph: parsed.graph
      ? {
          fn: parsed.graph.fn,
          domain: parsed.graph.domain,
          highlights: parsed.graph.highlights as {
            roots?: Array<[number, number]>;
            extrema?: Array<[number, number]>;
            asymptotes?: Array<{ x?: number; y?: number }>;
          },
        }
      : undefined,
    trap: parsed.trap,
    topic: parsed.topic || "Voice explanation",
    topicTag: parsed.topicTag,
    track: (parsed.track as CertificateTrack) || track,
    language,
    source,
    given: parsed.given,
    examTip: parsed.examTip
      ? { en: parsed.examTip.en, fr: parsed.examTip.fr || parsed.examTip.en, ar: parsed.examTip.ar }
      : undefined,
    studyKind: parsed.studyKind as StudyKind | undefined,
  });
  return {
    question,
    latexDraft: formatLebaneseEquation(parsed.latexDraft || parsed.given?.latex || latexSteps[0]?.latex || ""),
    latexSteps: latexSteps.length ? latexSteps : solution.steps,
    solution,
  };
}

async function parseWithGemini(transcript: string, language: LessonLanguage, track: CertificateTrack, formattedTranscript?: string) {
  const key = geminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const hints = extractLatexHints(transcript);
  const userText = [
    `Spoken transcript:\n${transcript}`,
    formattedTranscript && formattedTranscript !== transcript
      ? `Formatting cleaning layer (Lebanese / Word Insert Equation):\n${formattedTranscript}`
      : "",
    `Normalized draft: ${spokenMathToPlain(transcript)}`,
    hints.length ? `Detected spoken→LaTeX: ${hints.map((h) => `${h.spoken} → ${h.latex}`).join("; ")}` : "",
    `Language preference: ${language}`,
    `Track hint: ${track}`,
  ]
    .filter(Boolean)
    .join("\n");

  let lastError = "Gemini speech parser failed.";
  for (const model of geminiSpeechModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${SPEECH_PROMPT}\n\n${userText}` }] }],
          generationConfig: { temperature: 0.15, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) {
        lastError = `Gemini ${model} ${response.status}: ${(await response.text()).slice(0, 240)}`;
        continue;
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      const parsed = parseJsonSchema.parse(extractJson(text));
      return solutionFromParsed(parsed, transcript, language, track, "gemini");
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

async function parseWithOpenAI(transcript: string, language: LessonLanguage, track: CertificateTrack, formattedTranscript?: string) {
  const key = openaiSolverKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_VOICE_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o";
  const layer =
    formattedTranscript && formattedTranscript !== transcript
      ? `\nFormatting cleaning layer (Lebanese / Word Insert Equation):\n${formattedTranscript}`
      : "";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SPEECH_PROMPT },
        {
          role: "user",
          content: `Transcript:\n${transcript}${layer}\nNormalized: ${spokenMathToPlain(transcript)}\nLanguage: ${language}\nTrack: ${track}`,
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = parseJsonSchema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
  return solutionFromParsed(parsed, transcript, language, track, "openai");
}

export async function parseSpeechToMath(input: {
  transcript: string;
  formattedTranscript?: string;
  language?: LessonLanguage;
  track?: CertificateTrack;
}): Promise<{
  question: string;
  latexDraft: string;
  latexSteps: LatexStep[];
  solution: MathSolution;
  parseSource: VoiceParseSource;
  warning?: string;
}> {
  const language: LessonLanguage = input.language === "fr" ? "fr" : input.language === "en" ? "en" : "ar";
  const track: CertificateTrack = input.track ?? "ls";
  const formatted = input.formattedTranscript || formatLebaneseEquation(input.transcript);

  if (geminiApiKey()) {
    try {
      const parsed = await parseWithGemini(input.transcript, language, track, formatted);
      return { ...parsed, parseSource: "gemini" };
    } catch (error) {
      if (!openaiSolverKey()) {
        const demo = demoParseTranscript(input.transcript, language, track);
        return {
          question: demo.question,
          latexDraft: formatLebaneseEquation(demo.hints.map((h) => h.latex).join(" \\quad ") || demo.solution.given.latex),
          latexSteps: demo.latexSteps,
          solution: demo.solution,
          parseSource: "demo",
          warning: `Gemini failed (${error instanceof Error ? error.message : "error"}); used demo speech-to-LaTeX.`,
        };
      }
    }
  }

  if (openaiSolverKey()) {
    try {
      const parsed = await parseWithOpenAI(input.transcript, language, track, formatted);
      return { ...parsed, parseSource: "openai" };
    } catch (error) {
      const demo = demoParseTranscript(input.transcript, language, track);
      return {
        question: demo.question,
        latexDraft: formatLebaneseEquation(demo.hints.map((h) => h.latex).join(" \\quad ") || demo.solution.given.latex),
        latexSteps: demo.latexSteps,
        solution: demo.solution,
        parseSource: "demo",
        warning: `GPT-4o failed (${error instanceof Error ? error.message : "error"}); used demo speech-to-LaTeX.`,
      };
    }
  }

  const demo = demoParseTranscript(input.transcript, language, track);
  return {
    question: demo.question,
    latexDraft: formatLebaneseEquation(demo.hints.map((h) => h.latex).join(" \\quad ") || demo.solution.given.latex),
    latexSteps: demo.latexSteps,
    solution: demo.solution,
    parseSource: "demo",
    warning: demo.solution.warning,
  };
}
