/**
 * Client helper: after voice STT + Speech-to-LaTeX, call Direct-mode pedagogical tutor.
 * Curriculum comes from CurriculumSwitcher cookie / localStorage (passed by caller).
 */

import type { CurriculumId, CurriculumLanguage } from "@/lib/curriculum/types";
import type { PedagogicalTutorResult } from "@/lib/curriculum/tutorTypes";

export type TutorClientRequest = {
  text?: string;
  latex?: string;
  curriculumId: CurriculumId;
  language: CurriculumLanguage;
  mode?: "direct" | "socratic";
  revealAnswer?: boolean;
};

export type TutorClientError = {
  ok: false;
  error: string;
  errorAr: string;
  status?: number;
};

export type TutorClientOk = PedagogicalTutorResult & { ok: true };

export async function callPedagogicalTutorClient(
  req: TutorClientRequest,
): Promise<TutorClientOk | TutorClientError> {
  try {
    const response = await fetch("/api/ai/pedagogical-tutor", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: req.text?.trim() || undefined,
        latex: req.latex?.trim() || undefined,
        mode: req.mode ?? "direct",
        curriculumId: req.curriculumId,
        language: req.language,
        revealAnswer: req.revealAnswer ?? true,
      }),
    });
    const raw = await response.text();
    let payload: PedagogicalTutorResult | { error?: string; errorAr?: string } | null = null;
    try {
      payload = raw ? (JSON.parse(raw) as PedagogicalTutorResult | { error?: string; errorAr?: string }) : null;
    } catch {
      payload = null;
    }
    if (!response.ok || !payload || !("ok" in payload) || !payload.ok) {
      const fail = (payload ?? {}) as { error?: string; errorAr?: string };
      return {
        ok: false,
        error: fail.error || "Pedagogical tutor request failed.",
        errorAr: fail.errorAr || "تعذّر المعلّم البيداغوجي.",
        status: response.status,
      };
    }
    return payload;
  } catch {
    return {
      ok: false,
      error: "Network error while calling the pedagogical tutor.",
      errorAr: "خطأ في الشبكة أثناء استدعاء المعلّم البيداغوجي.",
    };
  }
}

/** Unique KaTeX fragments from a Direct-mode tutor result (steps + boxed answer). */
export function tutorLatexFragments(result: PedagogicalTutorResult): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    const cleaned = (raw ?? "").trim();
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    out.push(cleaned);
  };
  for (const step of result.steps) {
    push(step.latex);
  }
  push(result.finalAnswerLatex);
  return out;
}
