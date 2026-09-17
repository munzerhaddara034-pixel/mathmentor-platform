import { z } from "zod";
import { assembleSolution, type GraphSpec } from "./assemble";
import { demoSolve, type SolveRequest } from "./demoSolver";
import { retakeSolution } from "./retake";
import type { MathSolution, SolverStep } from "./types";

const geminiStepSchema = z.object({
  title: z.string(),
  titleFr: z.string().optional(),
  titleAr: z.string().optional(),
  latex: z.string(),
  theoremEn: z.string().optional(),
  theoremFr: z.string().optional(),
  theoremAr: z.string().optional(),
  explanationEn: z.string(),
  explanationFr: z.string(),
  explanationAr: z.string().optional(),
});

const geminiJsonSchema = z.object({
  needsRetake: z.boolean().optional(),
  retakeMessageEn: z.string().optional(),
  retakeMessageAr: z.string().optional(),
  summary: z.string().optional(),
  finalAnswer: z.string().optional(),
  finalAnswerLatex: z.string().optional(),
  topic: z.string().optional(),
  topicTag: z.string().optional(),
  track: z.string().optional(),
  given: z
    .object({
      latex: z.string(),
      aimEn: z.string(),
      aimFr: z.string().optional(),
      aimAr: z.string(),
    })
    .optional(),
  steps: z.array(geminiStepSchema).optional(),
  graph: z
    .object({
      fn: z.string(),
      domain: z.tuple([z.number(), z.number()]).optional(),
      yDomain: z.tuple([z.number(), z.number()]).optional(),
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

const SYSTEM = `You are Prof. Munzer Haddara (الأستاذ منذر حداره), expert mathematics teacher for the Lebanese Curriculum: Brevet (Grade 9), Terminale LS/GS/SE/LH, IB, and SAT.

Never use the name Al-Tarah or الطارة. The academy is MathMentor · أكاديمية منذر حداره.

Return ONE JSON object only:
{
  "needsRetake": boolean,
  "retakeMessageEn": string,
  "retakeMessageAr": string,
  "summary": string,
  "given": { "latex": string, "aimEn": string, "aimFr": string, "aimAr": string },
  "finalAnswer": string,
  "finalAnswerLatex": string,
  "topic": string,
  "topicTag": "quadratic" | "limits" | "exponential" | "systems" | "geometry" | "linear" | "complex" | "integrals" | "percentages" | "general",
  "track": "brevet" | "ls" | "se" | "gs" | "lh" | "sat",
  "steps": [
    {
      "title": string,
      "titleAr": string,
      "latex": string,
      "theoremEn": string,
      "theoremAr": string,
      "explanationEn": string,
      "explanationFr": string,
      "explanationAr": string
    }
  ],
  "graph": { "fn": "JS expression in x", "domain": [number, number], "highlights": { "roots": [[x,y]], "extrema": [[x,y]], "asymptotes": [{"y": number}] } },
  "trap": { "wrong": string, "wrongFr": string, "correction": string, "correctionFr": string, "latex": string }
}

Hard rules (Lebanese exam accuracy):
1. ALL mathematics MUST be pure LaTeX (never Unicode mini-math). Use f'(x), \\int, \\lim, \\ln, e^{x}, z=a+ib, \\mathbb{R}.
2. Always three pedagogical sections:
   a) Given & Aim (المعطيات والمطلوب) in "given"
   b) Step-by-step: every step names the theorem/reason (theoremEn / theoremAr) then the algebra
   c) Final Answer Box: finalAnswerLatex is the boxed line
3. HALLUCINATION GUARD: if the uploaded image is blurry, cropped, or incomplete, set needsRetake=true, fill retakeMessageEn AND retakeMessageAr, and DO NOT invent a problem or a number. Ask the student to rephotograph.
4. At least 3 graded steps when needsRetake is false. EN+FR+AR of equal quality.
5. graph.fn is a JavaScript expression in x.
6. Instructor voice: calm official-exam barème.`;

function geminiModels() {
  const pinned = process.env.GEMINI_MODEL?.trim();
  return pinned
    ? [pinned]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
}

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

  const steps: SolverStep[] = (parsed.steps ?? []).map((step) => ({
    title: step.title,
    titleFr: step.titleFr,
    titleAr: step.titleAr,
    latex: step.latex,
    theoremEn: step.theoremEn,
    theoremFr: step.theoremFr,
    theoremAr: step.theoremAr,
    explanationEn: step.explanationEn,
    explanationFr: step.explanationFr,
    explanationAr: step.explanationAr,
  }));

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
    language: request.language,
    source,
    recognizedFromImage: request.imageBase64 ? request.imageName : undefined,
    given: parsed.given,
  });
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Gemini did not return JSON.");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export async function solveWithGemini(
  request: SolveRequest & { imageBase64?: string; mimeType?: string },
): Promise<MathSolution> {
  const key = geminiApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const userText = [
    request.latex ? `LaTeX: ${request.latex}` : "",
    request.question ? `Question: ${request.question}` : "",
    `Language preference: ${request.language ?? "en"}`,
    `Track hint: ${request.track ?? "ls"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Array<Record<string, unknown>> = [{ text: `${SYSTEM}\n\n${userText || "Solve the problem in the image."}` }];
  if (request.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: request.mimeType || "image/jpeg",
        data: request.imageBase64,
      },
    });
  }

  let lastError = "Gemini request failed.";
  for (const model of geminiModels()) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
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
      const parsed = geminiJsonSchema.parse(extractJson(text));
      return solutionFromLlm(parsed, request, "gemini");
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

export async function solveWithOpenAI(request: SolveRequest): Promise<MathSolution> {
  const key = openaiSolverKey();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
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

export function demoFallback(request: SolveRequest, warning: string): MathSolution {
  const solution = demoSolve(request);
  solution.warning = warning;
  return solution;
}
