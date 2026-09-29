/**
 * محمد as مدقّق الحلول — a second, independent Gemini pass over AI solutions.
 * Runs in the background after the solution is saved; never blocks or breaks the solver.
 * Result is written to the admin AI query log (auditStatus / auditNote = Teacher Audit).
 */
import { z } from "zod";
import { AGENT_PERSONA_AR, NEEDS_REVIEW_AR, SOLUTION_VERIFIER_RULES_AR } from "@/lib/agent/persona";
import { extractJson, geminiApiKey, geminiModels } from "./llm";
import { getMathQuery, patchMathQuery } from "./store";
import type { MathQueryRecord } from "./types";

const VERIFY_TIMEOUT_MS = 25_000;

const verdictSchema = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  issues: z.array(z.string()).optional(),
  correctedFinalAnswer: z.string().optional(),
  noteAr: z.string().optional(),
});

export type SolutionVerdict = {
  status: "verified" | "needs_fix" | "unverified";
  noteAr: string;
  issues: string[];
  correctedFinalAnswer?: string;
};

function buildPrompt(record: MathQueryRecord): string {
  const steps = record.steps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.latex}`)
    .join("\n");
  return [
    AGENT_PERSONA_AR,
    ...SOLUTION_VERIFIER_RULES_AR,
    "Return JSON only:",
    `{ "verdict": "correct"|"incorrect"|"uncertain", "issues": string[], "correctedFinalAnswer"?: string, "noteAr": string }`,
    `Use "correct" ONLY if your independent recomputation fully agrees. If unsure, use "uncertain".`,
    "",
    `Track: ${record.track}`,
    `Question: ${record.question}`,
    record.latex ? `LaTeX: ${record.latex}` : "",
    `Steps:\n${steps}`,
    `Final answer: ${record.finalAnswer} | ${record.finalAnswerLatex}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callGemini(prompt: string, key: string): Promise<z.infer<typeof verdictSchema>> {
  let lastError = "Gemini verification failed.";
  for (const model of geminiModels()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      });
      if (!response.ok) {
        lastError = `Gemini ${model} ${response.status}`;
        continue;
      }
      const json = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
      return verdictSchema.parse(extractJson(text));
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}

/** Independent check of one saved AI solution. Never throws. */
export async function verifySolution(record: MathQueryRecord): Promise<SolutionVerdict> {
  const key = geminiApiKey();
  if (!key) {
    return { status: "unverified", noteAr: `${NEEDS_REVIEW_AR} — لم يتم التحقق (لا يوجد GEMINI_API_KEY).`, issues: [] };
  }
  try {
    const result = await callGemini(buildPrompt(record), key);
    const issues = (result.issues ?? []).map((item) => item.slice(0, 300)).slice(0, 8);
    if (result.verdict === "correct" && issues.length === 0) {
      return { status: "verified", noteAr: `✅ محمد: تم التحقق — ${result.noteAr ?? "الحل صحيح"}`.slice(0, 500), issues };
    }
    if (result.verdict === "incorrect") {
      const fix = result.correctedFinalAnswer ? ` · التصحيح المقترح: ${result.correctedFinalAnswer}` : "";
      return {
        status: "needs_fix",
        noteAr: `❌ ${NEEDS_REVIEW_AR} — ${result.noteAr ?? issues[0] ?? "خطأ رياضي"}${fix}`.slice(0, 500),
        issues,
        correctedFinalAnswer: result.correctedFinalAnswer,
      };
    }
    return { status: "unverified", noteAr: `⚠️ ${NEEDS_REVIEW_AR} — محمد غير متأكد: ${result.noteAr ?? issues[0] ?? ""}`.slice(0, 500), issues };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return { status: "unverified", noteAr: `⚠️ ${NEEDS_REVIEW_AR} — تعذّر التحقق (${reason.slice(0, 120)}).`, issues: [] };
  }
}

async function notifyMunzer(record: MathQueryRecord, verdict: SolutionVerdict): Promise<void> {
  const { notifyStaff } = await import("@/lib/notifications/store");
  await notifyStaff({
    kind: "solver_issue",
    title: "Solution needs review",
    titleAr: `حل ${NEEDS_REVIEW_AR}`,
    body: `Mohamed flagged an AI solution: ${record.question.slice(0, 120)}`,
    bodyAr: verdict.noteAr,
    href: "/admin",
    relatedId: record.id,
  });
}

/**
 * Fire-and-forget: verify an AI solution and mark it in the admin log.
 * Only touches records still "pending" without a teacher note, so manual Teacher Audit wins.
 */
export function scheduleSolutionVerification(record: MathQueryRecord): void {
  if (record.source === "demo" || record.needsRetake) return;
  void (async () => {
    try {
      const verdict = await verifySolution(record);
      const current = await getMathQuery(record.id);
      if (!current || (current.auditStatus ?? "pending") !== "pending" || current.auditNote) return;
      await patchMathQuery(record.id, {
        auditStatus: verdict.status === "unverified" ? "pending" : verdict.status,
        auditNote: verdict.noteAr,
      });
      if (verdict.status === "needs_fix") await notifyMunzer(record, verdict);
    } catch (error) {
      console.warn("[mathmentor] solution verification skipped:", error instanceof Error ? error.message : error);
    }
  })();
}
