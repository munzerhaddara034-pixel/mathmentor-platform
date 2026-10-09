import { z } from "zod";
import { SOLVER_SYSTEM_PROMPT } from "@/lib/pedagogy/lebanese";
import type { LessonLanguage } from "@/lib/studio/timeline";
import { assembleSolution, type GraphSpec } from "./assemble";
import { clampSolverBudget, SOLVER_TOTAL_BUDGET_MS } from "./budget";
import { detectCurriculum, type CurriculumDecision } from "./curriculum/index";
import { demoSolve, type SolveRequest } from "./demoSolver";
import { generate, GeminiError, type CallRecord, type GeminiPart } from "./gemini/client";
import { tierForLevel, type ModelTier } from "./gemini/models";
import { buildSolverPrompt } from "./prompt";
import { retakeSolution } from "./retake";
import { asymptotesSchema, studyKindSchema } from "./studyKindSchema";
import type { MathSolution, SolverStep, StudyKind } from "./types";

export { geminiModels } from "./gemini/models";

const geminiStepSchema = z.object({
  title: z.string(),
  titleFr: z.string().optional(),
  titleAr: z.string().optional(),
  examVerbEn: z.string().optional(),
  examVerbFr: z.string().optional(),
  latex: z.string(),
  theoremEn: z.string().optional(),
  theoremFr: z.string().optional(),
  theoremAr: z.string().optional(),
  // Only the solution language is required now (English by default).
  explanationEn: z.string().optional(),
  explanationFr: z.string().optional(),
  explanationAr: z.string().optional(),
  boxed: z.boolean().optional(),
});

const geminiJsonSchema = z.object({
  needsRetake: z.boolean().optional(),
  retakeMessageEn: z.string().optional(),
  retakeMessageAr: z.string().optional(),
  summary: z.string().optional(),
  examTip: z
    .object({
      en: z.string().default(""),
      fr: z.string().optional(),
      ar: z.string().optional(),
    })
    .optional(),
  // Coerced, never rejecting: a model label like "integrals" must not discard a valid solution.
  studyKind: studyKindSchema,
  asymptotes: asymptotesSchema,
  finalAnswer: z.string().optional(),
  finalAnswerLatex: z.string().optional(),
  topic: z.string().optional(),
  topicTag: z.string().optional(),
  track: z.string().optional(),
  given: z
    .object({
      latex: z.string(),
      aimEn: z.string().default(""),
      aimFr: z.string().optional(),
      aimAr: z.string().default(""),
    })
    .optional(),
  steps: z.array(geminiStepSchema).optional(),
  /** Machine-checkable claims for the CAS pass (validated leniently in cas/claims.ts). */
  checks: z.array(z.unknown()).optional().catch(undefined),
  graph: z
    .object({
      fn: z.string(),
      // An awkward window is an enrichment, not the answer: drop it instead of failing the solution.
      domain: z.tuple([z.number(), z.number()]).optional().catch(undefined),
      yDomain: z.tuple([z.number(), z.number()]).optional().catch(undefined),
      highlights: z.unknown().optional(),
    })
    .optional()
    // A malformed optional graph/trap must not discard an otherwise valid solution.
    .catch(undefined),
  trap: z
    .object({
      wrong: z.string(),
      wrongFr: z.string(),
      correction: z.string(),
      correctionFr: z.string(),
      latex: z.string(),
    })
    .optional()
    .catch(undefined),
});

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || "";
}

export function openaiSolverKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || "";
}

export function hasGeminiKey() {
  return geminiApiKey().length > 0;
}

const SYSTEM = SOLVER_SYSTEM_PROMPT;

function solutionFromLlm(
  parsed: z.infer<typeof geminiJsonSchema>,
  request: SolveRequest & { imageBase64?: string; imageName?: string },
  source: MathSolution["source"],
): MathSolution {
  const question = request.question || request.latex || (request.imageName ? `(image) ${request.imageName}` : "Problem");
  if (parsed.needsRetake) {
    const retake = retakeSolution({
      question,
      language: request.language,
      imageName: request.imageName,
      source,
    });
    if (parsed.retakeMessageEn) retake.retakeMessageEn = parsed.retakeMessageEn;
    if (parsed.retakeMessageAr) retake.retakeMessageAr = parsed.retakeMessageAr;
    return retake;
  }

  const language: LessonLanguage = request.language ?? "en";
  const steps: SolverStep[] = (parsed.steps ?? []).map((step) => {
    const primary =
      (language === "fr" ? step.explanationFr : language === "ar" ? step.explanationAr : step.explanationEn) ||
      step.explanationEn ||
      step.explanationFr ||
      step.explanationAr ||
      "";
    return {
      title: step.title,
      titleFr: step.titleFr,
      titleAr: step.titleAr,
      examVerbEn: step.examVerbEn,
      examVerbFr: step.examVerbFr,
      latex: step.latex,
      theoremEn: step.theoremEn,
      theoremFr: step.theoremFr,
      theoremAr: step.theoremAr,
      explanationEn: step.explanationEn || primary,
      explanationFr: step.explanationFr || (language === "fr" ? primary : ""),
      explanationAr: step.explanationAr || (language === "ar" ? primary : undefined),
      boxed: step.boxed,
    };
  });

  const graph: GraphSpec | undefined = parsed.graph
    ? {
        fn: parsed.graph.fn,
        domain: parsed.graph.domain,
        yDomain: parsed.graph.yDomain,
        highlights: parsed.graph.highlights as GraphSpec["highlights"],
      }
    : undefined;

  return assembleSolution({
    question,
    summary: parsed.summary || parsed.given?.aimEn || "Graded Lebanese-curriculum solution.",
    finalAnswer: parsed.finalAnswer || parsed.finalAnswerLatex || "",
    finalAnswerLatex: parsed.finalAnswerLatex || parsed.finalAnswer || "",
    steps,
    graph,
    trap: parsed.trap,
    topic: parsed.topic || "AI solution",
    topicTag: parsed.topicTag,
    track: (parsed.track as MathSolution["track"]) || request.track || "ls",
    language,
    source,
    recognizedFromImage: request.imageBase64 ? request.imageName : undefined,
    given: parsed.given,
    examTip: parsed.examTip
      ? { en: parsed.examTip.en, fr: parsed.examTip.fr || "", ar: parsed.examTip.ar }
      : undefined,
    studyKind: parsed.studyKind as StudyKind | undefined,
    asymptotes: parsed.asymptotes,
  });
}

/**
 * LaTeX commands whose first letter is also a JSON escape (\\f \\t \\b \\n \\r): a single backslash
 * would silently turn "\\frac" into form-feed + "rac". Double it before JSON.parse.
 */
const LATEX_ESCAPE_COLLISIONS =
  /(?<!\\)\\(frac|forall|text|textbf|times|theta|tan|tanh|to|tfrac|top|beta|bar|binom|boxed|bmatrix|begin|bullet|neq|nabla|notin|not|nu|newline|right|rightarrow|Rightarrow|rho|rangle|rfloor|rceil)(?![A-Za-z])/g;

export function protectLatexEscapes(json: string): string {
  return json.replace(LATEX_ESCAPE_COLLISIONS, "\\\\$1");
}

export function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.");
  const body = protectLatexEscapes(raw.slice(start, end + 1));
  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    // LLMs often emit raw LaTeX backslashes (\lim, \sqrt, \infty) inside JSON strings.
    // Retry once with only the *invalid* escapes doubled; valid JSON escapes are untouched.
    const repaired = body.replace(/\\(["\\/bfnrtu])|\\/g, (match: string, valid?: string) => (valid ? match : "\\\\"));
    if (repaired === body) throw error;
    return JSON.parse(repaired) as unknown;
  }
}

export type GeminiSolveRequest = SolveRequest & {
  imageBase64?: string;
  mimeType?: string;
  /** Explicit curriculum from the form ("auto" = detect). */
  curriculum?: string;
  /** Platform curriculum id (fallback for detection). */
  platformCurriculum?: string;
  /** Explicit WhatsApp / form level (PRIMARY — never overridden by text heuristics). */
  level?: CurriculumDecision["level"];
  /** Precomputed decision (repair pass reuses it). */
  decision?: CurriculumDecision;
  /** CAS failures from a previous attempt: triggers a repair solve. */
  feedback?: string;
};

type TierBudget = { thinking: "low" | "medium" | "high"; maxOutputTokens: number; deadlineMs: number; callTimeoutMs: number };

/** Token caps and time budgets per level. Middle school targets < 15 s. */
function baseBudgetFor(decision: CurriculumDecision, tier: ModelTier): TierBudget {
  if (tier === "fast") return { thinking: "low", maxOutputTokens: 8192, deadlineMs: 30_000, callTimeoutMs: 25_000 };
  if (decision.level === "university") return { thinking: "high", maxOutputTokens: 20_480, deadlineMs: 180_000, callTimeoutMs: 100_000 };
  return { thinking: "medium", maxOutputTokens: 16_384, deadlineMs: 120_000, callTimeoutMs: 90_000 };
}

export function decideFor(request: GeminiSolveRequest): CurriculumDecision {
  return (
    request.decision ??
    detectCurriculum({
      question: request.question,
      latex: request.latex,
      track: request.track,
      selected: request.curriculum,
      platform: request.platformCurriculum,
      level: request.level,
    })
  );
}

export function tierFor(decision: CurriculumDecision): ModelTier {
  return tierForLevel(decision.level, { satAct: decision.curriculum === "sat_act" && !decision.proof });
}

/**
 * Speed knobs for the free tier, where a 6k-token answer with medium reasoning costs ~20s:
 * SOLVER_THINKING=low|medium|high and SOLVER_MAX_OUTPUT_TOKENS=n (never raises the tier's own cap).
 */
function applySpeedOverrides(budget: TierBudget): TierBudget {
  const thinking = process.env.SOLVER_THINKING?.trim().toLowerCase();
  const allowed = thinking === "low" || thinking === "medium" || thinking === "high";
  const capped = Number(process.env.SOLVER_MAX_OUTPUT_TOKENS);
  return {
    ...budget,
    thinking: allowed ? (thinking as TierBudget["thinking"]) : budget.thinking,
    maxOutputTokens: Number.isFinite(capped) && capped >= 2048 ? Math.min(budget.maxOutputTokens, capped) : budget.maxOutputTokens,
  };
}

export function budgetFor(decision: CurriculumDecision, tier: ModelTier): TierBudget {
  return applySpeedOverrides(baseBudgetFor(decision, tier));
}

export async function solveWithGemini(
  request: GeminiSolveRequest,
  options: { deadlineMs?: number; tierOverride?: ModelTier } = {},
): Promise<MathSolution> {
  const started = Date.now();
  const decision = decideFor(request);
  // The rescue path forces the fast tier on the same free key: the question level (and prompt) stay intact.
  const tier = options.tierOverride ?? tierFor(decision);
  // The tier budget is the ceiling, never the promise: it is clamped to what the request has left.
  const budget = clampSolverBudget(budgetFor(decision, tier), options.deadlineMs ?? SOLVER_TOTAL_BUDGET_MS);
  const language: LessonLanguage = request.language ?? "en";
  const text = buildSolverPrompt({
    question: request.question,
    latex: request.latex,
    track: request.track,
    language,
    decision,
    feedback: request.feedback,
  });
  const parts: GeminiPart[] = [{ text }];
  if (request.imageBase64) {
    parts.push({ inline_data: { mime_type: request.mimeType || "image/jpeg", data: request.imageBase64 } });
  }

  let calls: CallRecord[] = [];
  try {
    const result = await generate({ parts, tier, ...budget });
    calls = result.calls;
    const parsed = geminiJsonSchema.parse(extractJson(result.text));
    const track = decision.level === "university" ? "university" : undefined;
    const solution = solutionFromLlm(parsed, { ...request, language, track: track ?? request.track }, "gemini");
    if (track) solution.track = track;
    solution.curriculum = decision.curriculum;
    solution.solverMeta = {
      curriculum: decision.curriculum,
      level: decision.level,
      tier,
      model: result.model,
      calls,
      solveMs: Date.now() - started,
      costUsd: calls.reduce((sum, call) => sum + call.costUsd, 0),
      checks: parsed.checks,
      repaired: Boolean(request.feedback),
    };
    return solution;
  } catch (error) {
    const log = error instanceof GeminiError ? error.calls : calls;
    const message = error instanceof Error ? error.message : "Gemini request failed.";
    throw new GeminiError(message, log);
  }
}

/** Hard deadline: without it a stalled provider holds the route until the platform timeout. */
const OPENAI_TIMEOUT_MS = 60_000;

export async function solveWithOpenAI(request: SolveRequest, options: { deadlineMs?: number } = {}): Promise<MathSolution> {
  const key = openaiSolverKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const timeoutMs = clampSolverBudget({ deadlineMs: OPENAI_TIMEOUT_MS, callTimeoutMs: OPENAI_TIMEOUT_MS }, options.deadlineMs ?? SOLVER_TOTAL_BUDGET_MS).callTimeoutMs;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${request.latex ?? ""}\n${request.question}` },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = geminiJsonSchema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
  return solutionFromLlm(parsed, request, "openai");
}

/** DeepSeek key (OpenAI-compatible endpoint). Empty when the provider is not configured. */
const PROVIDER_KEY_SHAPE = /^[A-Za-z0-9_\-]{20,}$/;

/**
 * A key that is present but unusable (placeholder text, quotes, spaces, non-ASCII) must never be used:
 * it would fail anyway AND it would shorten Gemini's budget by the rescue reserve.
 */
export function deepseekConfigIssue(): string | null {
  const raw = process.env.DEEPSEEK_API_KEY?.trim() || "";
  if (!raw) return null;
  return PROVIDER_KEY_SHAPE.test(raw)
    ? null
    : "deepseek: DEEPSEEK_API_KEY is set but unusable — paste only the sk-… key, without quotes, spaces or placeholder text";
}

export function deepseekSolverKey(): string {
  const raw = process.env.DEEPSEEK_API_KEY?.trim() || "";
  return deepseekConfigIssue() ? "" : raw;
}

const DEEPSEEK_TIMEOUT_MS = 45_000;

/**
 * DeepSeek solve: cheap, fast, OpenAI-compatible JSON mode. Used as the rescue provider when Gemini is
 * missing, slow or failing, so a student still gets an answer instead of a dead request.
 */
export async function solveWithDeepSeek(request: SolveRequest, options: { deadlineMs?: number } = {}): Promise<MathSolution> {
  const key = deepseekSolverKey();
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set.");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
  const base = (process.env.DEEPSEEK_API_BASE?.trim() || "https://api.deepseek.com").replace(/\/+$/, "");
  const timeoutMs = clampSolverBudget({ deadlineMs: DEEPSEEK_TIMEOUT_MS, callTimeoutMs: DEEPSEEK_TIMEOUT_MS }, options.deadlineMs ?? SOLVER_TOTAL_BUDGET_MS).callTimeoutMs;
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${request.latex ?? ""}\n${request.question}` },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
  const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = geminiJsonSchema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "{}"));
  return solutionFromLlm(parsed, request, "deepseek");
}

export function demoFallback(request: SolveRequest, warning: string): MathSolution {
  const solution = demoSolve(request);
  solution.warning = warning;
  return solution;
}
