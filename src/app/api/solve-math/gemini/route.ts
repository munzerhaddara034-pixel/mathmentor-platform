/**
 * Owner's direct Gemini solver (formerly POST/GET /api/solve-math).
 * Contract kept: POST { problem | question | text } → { success, data }.
 * Now: AI-access auth required, shared model list (no retired ids), no provider error details.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiRequireAiAccess } from "@/lib/auth/guards";
import { extractJson } from "@/lib/solver/llm";
import { generate, geminiKey } from "@/lib/solver/gemini/client";
import { TUTOR_PERSONA_EN } from "@/lib/tutor/persona";

export const runtime = "nodejs";

type SolveBody = { problem?: unknown; question?: unknown; text?: unknown };

const MAX_PROBLEM_CHARS = 4000;

function prompt(problem: string): string {
  return `${TUTOR_PERSONA_EN}
Solve the following problem in full, step by step and with doctor-level rigour, using KaTeX LaTeX (\\frac instead of slash fractions, x^{2}), and check the answer by substitution.
Write in English unless the problem is written in Arabic or French (then answer in that language).
Problem:
"""
${problem}
"""
Return JSON only: { "summary": string, "steps": string[], "finalAnswer": string }`;
}

export async function POST(req: NextRequest) {
  const guard = await apiRequireAiAccess();
  if (guard.error) return guard.error;
  try {
    const body = (await req.json().catch(() => ({}))) as SolveBody;
    const candidate = [body.problem, body.question, body.text].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const problem = (candidate ?? "").trim().slice(0, MAX_PROBLEM_CHARS);
    if (!problem) {
      return NextResponse.json({ error: "يرجى تقديم نص المسألة الرياضية المراد حلها." }, { status: 400 });
    }
    if (!geminiKey()) {
      return NextResponse.json(
        { error: "الحل الذكي غير مفعّل حالياً.", demoMode: true, solution: "⚠️ الحل الذكي المباشر غير مفعّل حالياً." },
        { status: 200 },
      );
    }
    const result = await generate({
      parts: [{ text: prompt(problem) }],
      tier: "strong",
      thinking: "medium",
      maxOutputTokens: 16_384,
      deadlineMs: 90_000,
      callTimeoutMs: 75_000,
    });
    const data = extractJson(result.text);
    return NextResponse.json({ success: true, problem, data, model: result.model });
  } catch (error) {
    // Log server-side only; never return provider messages (quota, model ids, keys) to the caller.
    console.error("Math Solver Error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { success: false, error: "حدث خطأ أثناء معالجة وحل المسألة الرياضية. حاول مجدداً بعد قليل." },
      { status: 502 },
    );
  }
}

// Health check (no secrets).
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "MathMentor Math Solver Engine",
    geminiConfigured: geminiKey().length > 0,
  });
}
