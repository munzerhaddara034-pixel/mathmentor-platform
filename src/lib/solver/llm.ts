import { z } from "zod";
import { assembleSolution, type GraphSpec } from "./assemble";
import { demoSolve, type SolveRequest } from "./demoSolver";
import type { MathSolution, SolverStep } from "./types";

const geminiStepSchema = z.object({
  title: z.string(),
  titleFr: z.string().optional(),
  titleAr: z.string().optional(),
  latex: z.string(),
  explanationEn: z.string(),
  explanationFr: z.string(),
  explanationAr: z.string().optional(),
});

const geminiJsonSchema = z.object({
  summary: z.string(),
  finalAnswer: z.string(),
  finalAnswerLatex: z.string(),
  topic: z.string().optional(),
  track: z.string().optional(),
  steps: z.array(geminiStepSchema).min(3),
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
  "summary": string,
  "finalAnswer": string,
  "finalAnswerLatex": string,
  "topic": string,
  "track": "brevet" | "ls" | "se" | "gs" | "lh" | "sat",
  "steps": [
    { "title": string, "titleFr": string, "latex": string, "explanationEn": string, "explanationFr": string, "explanationAr": string }
  ],
  "graph": { "fn": "JS expression in x", "domain": [number, number], "highlights": { "roots": [[x,y]], "extrema": [[x,y]], "asymptotes": [{"y": number}] } },
  "trap": { "wrong": string, "wrongFr": string, "correction": string, "correctionFr": string, "latex": string }
}

Rules:
- At least 3 graded steps. Each step has real LaTeX and EN+FR of equal quality (Lebanese English-section / French-section papers).
- Name theorems with hypotheses. No jumping to a boxed number.
- graph.fn is a JavaScript expression in x (e.g. "(x-1)*exp(x)").
- If the photo is a handwritten problem, transcribe it first then solve.
- Instructor voice: calm, precise, official-exam barème.`;

function geminiModels() {
  const pinned = process.env.GEMINI_MODEL?.trim();
  return pinned
    ? [pinned]
    : ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
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
      const steps: SolverStep[] = parsed.steps;
      const graph: GraphSpec | undefined = parsed.graph
        ? {
            fn: parsed.graph.fn,
            domain: parsed.graph.domain,
            yDomain: parsed.graph.yDomain,
            highlights: parsed.graph.highlights as GraphSpec["highlights"],
          }
        : undefined;
      return assembleSolution({
        question: request.question || request.latex || "Image problem",
        summary: parsed.summary,
        finalAnswer: parsed.finalAnswer,
        finalAnswerLatex: parsed.finalAnswerLatex,
        steps,
        graph,
        trap: parsed.trap,
        topic: parsed.topic || "AI solution",
        track: (parsed.track as MathSolution["track"]) || request.track || "ls",
        language: request.language,
        source: "gemini",
        recognizedFromImage: request.imageBase64 ? request.imageName : undefined,
      });
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
  return assembleSolution({
    question: request.question || request.latex || "Problem",
    summary: parsed.summary,
    finalAnswer: parsed.finalAnswer,
    finalAnswerLatex: parsed.finalAnswerLatex,
    steps: parsed.steps,
    graph: parsed.graph
      ? { fn: parsed.graph.fn, domain: parsed.graph.domain, yDomain: parsed.graph.yDomain, highlights: parsed.graph.highlights as GraphSpec["highlights"] }
      : undefined,
    trap: parsed.trap,
    topic: parsed.topic || "AI solution",
    track: request.track || "ls",
    language: request.language,
    source: "openai",
  });
}

export function demoFallback(request: SolveRequest, warning: string): MathSolution {
  const solution = demoSolve(request);
  solution.warning = warning;
  return solution;
}
