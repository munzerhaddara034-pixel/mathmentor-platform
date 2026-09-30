/**
 * محمد as مدقّق الحلول — a second, independent Gemini pass over AI solutions.
 * University / Bac: runs synchronously before the student sees the answer (see pipeline.ts).
 * Middle school: runs in the background and only updates the admin audit log.
 */
import { z } from "zod";
import { AGENT_PERSONA_AR, NEEDS_REVIEW_AR, SOLUTION_VERIFIER_RULES_AR } from "@/lib/agent/persona";
import { generate, type CallRecord } from "./gemini/client";
import type { ModelTier } from "./gemini/models";
import { extractJson, geminiApiKey } from "./llm";
import { getMathQuery, patchMathQuery } from "./store";
import type { MathQueryRecord, SolverStep } from "./types";

/** The fields the verifier needs (a saved record or an unsaved solution). */
export type VerifiableSolution = {
  question: string;
  latex?: string;
  track: string;
  steps: SolverStep[];
  finalAnswer: string;
  finalAnswerLatex: string;
};

export type VerifyOptions = { tier?: ModelTier; casReport?: string; university?: boolean };

const verdictSchema = z.object({
  verdict: z.enum(["correct", "incorrect", "uncertain"]),
  issues: z.array(z.string()).optional(),
  correctedFinalAnswer: z.string().optional(),
  correctedFinalAnswerLatex: z.string().optional(),
  noteAr: z.string().optional(),
});

export type SolutionVerdict = {
  status: "verified" | "needs_fix" | "unverified";
  noteAr: string;
  issues: string[];
  correctedFinalAnswer?: string;
  correctedFinalAnswerLatex?: string;
  calls: CallRecord[];
};

function buildPrompt(record: VerifiableSolution, options: VerifyOptions): string {
  const steps = record.steps
    .map((step, index) => `${index + 1}. ${step.title}: ${step.latex}${step.explanationEn ? ` — ${step.explanationEn}` : ""}`)
    .join("\n");
  return [
    AGENT_PERSONA_AR,
    ...SOLUTION_VERIFIER_RULES_AR,
    "Check EVERY sub-question: is each one answered, is each boxed result equal to what the steps derived, are theorems stated with hypotheses, is uniqueness proved on the whole domain?",
    "Never claim you multiplied or substituted unless you show the numbers in issues.",
    options.casReport ? `Deterministic CAS findings (trust these numbers):\n${options.casReport}` : "",
    "Return JSON only:",
    `{ "verdict": "correct"|"incorrect"|"uncertain", "issues": string[], "correctedFinalAnswer"?: string, "correctedFinalAnswerLatex"?: string, "noteAr": string }`,
    `correctedFinalAnswerLatex: the full corrected final box in KaTeX (\\frac, ^{ }, no slash fractions), one line per sub-question. Omit when correct.`,
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

async function callVerifier(prompt: string, options: VerifyOptions) {
  const result = await generate({
    parts: [{ text: prompt }],
    tier: options.tier ?? "fast",
    thinking: options.university ? "high" : options.tier === "strong" ? "medium" : "low",
    maxOutputTokens: options.tier === "strong" ? 16_384 : 6_144,
    deadlineMs: options.tier === "strong" ? 90_000 : 40_000,
    callTimeoutMs: options.tier === "strong" ? 75_000 : 30_000,
  });
  return { verdict: verdictSchema.parse(extractJson(result.text)), calls: result.calls };
}

/** Independent check of one AI solution. Never throws. */
export async function verifySolution(record: VerifiableSolution, options: VerifyOptions = {}): Promise<SolutionVerdict> {
  if (!geminiApiKey()) {
    return { status: "unverified", noteAr: `${NEEDS_REVIEW_AR} — لم يتم التحقق (لا يوجد GEMINI_API_KEY).`, issues: [], calls: [] };
  }
  let calls: CallRecord[] = [];
  try {
    const called = await callVerifier(buildPrompt(record, options), options);
    calls = called.calls;
    const result = called.verdict;
    const issues = (result.issues ?? []).map((item) => item.slice(0, 300)).slice(0, 8);
    if (result.verdict === "correct" && issues.length === 0) {
      return { status: "verified", noteAr: `✅ محمد: تم التحقق — ${result.noteAr ?? "الحل صحيح"}`.slice(0, 500), issues, calls };
    }
    if (result.verdict === "incorrect") {
      const fix = result.correctedFinalAnswer ? ` · التصحيح المقترح: ${result.correctedFinalAnswer}` : "";
      return {
        status: "needs_fix",
        noteAr: `❌ ${NEEDS_REVIEW_AR} — ${result.noteAr ?? issues[0] ?? "خطأ رياضي"}${fix}`.slice(0, 500),
        issues,
        correctedFinalAnswer: result.correctedFinalAnswer,
        correctedFinalAnswerLatex: result.correctedFinalAnswerLatex,
        calls,
      };
    }
    return { status: "unverified", noteAr: `⚠️ ${NEEDS_REVIEW_AR} — محمد غير متأكد: ${result.noteAr ?? issues[0] ?? ""}`.slice(0, 500), issues, calls };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return { status: "unverified", noteAr: `⚠️ ${NEEDS_REVIEW_AR} — تعذّر التحقق (${reason.slice(0, 120)}).`, issues: [], calls };
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
  const synced = record.solverMeta?.verification;
  if (synced?.mode === "sync") {
    // Already verified before responding; the audit fields were saved with the record.
    if (synced.status === "needs_fix") {
      void notifyMunzer(record, { status: "needs_fix", noteAr: synced.noteAr, issues: [], calls: [] }).catch(() => undefined);
    }
    return;
  }
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
