/** Assemble the per-request solver prompt: base prompt + curriculum style + language + level rules. */
import { SOLVER_SYSTEM_PROMPT } from "@/lib/pedagogy/lebanese";
import { curriculumStyleBlock, type CurriculumDecision } from "./curriculum/index.ts";
import type { LessonLanguage } from "@/lib/studio/timeline";

const LANGUAGE_NAME: Record<LessonLanguage, string> = { en: "English", fr: "French", ar: "Arabic" };
const LANGUAGE_FIELD: Record<LessonLanguage, string> = { en: "En", fr: "Fr", ar: "Ar" };

export function languageBlock(language: LessonLanguage): string {
  const name = LANGUAGE_NAME[language];
  const suffix = LANGUAGE_FIELD[language];
  return [
    `SOLUTION LANGUAGE: ${name} (the student's choice; English is the default).`,
    `Write title, summary, finalAnswer, examTip.en, given.aimEn and every explanation${suffix} in ${name} ONLY.`,
    language === "en"
      ? "Leave the Fr/Ar variants empty (this overrides any bilingual EN+FR instruction above)."
      : `Also put the same ${name} text in explanationEn, and leave the third language empty (this overrides any bilingual instruction above).`,
    "Keep official exam verbs in their standard form for the curriculum.",
  ].join("\n");
}

function levelBlock(decision: CurriculumDecision): string {
  if (decision.level === "middle") {
    return [
      "LEVEL: middle school (Brevet / Grades 7–9) ONLY.",
      "Simple language a Grade 7–9 student can copy; 3 to 6 short numbered steps; units in every final answer.",
      "HARD RULE: never write secondary/Bac function-study tables, Terminale barème phrasing, IB command-term essays, or university proofs in this answer. One level only — do not mix.",
    ].join(" ");
  }
  if (decision.level === "university") {
    return [
      "LEVEL: university ONLY.",
      "Full proof-level rigour: every claim justified, theorems stated with hypotheses, computations shown (kernel systems, constants from initial conditions).",
      "HARD RULE: never simplify to middle-school steps or secondary barème shortcuts. One level only — do not mix.",
    ].join(" ");
  }
  return [
    "LEVEL: secondary / Bac ONLY.",
    "Official-exam rigour with the mark scheme (Barème / markscheme) of the curriculum above.",
    "HARD RULE: never drop to middle-school oversimplification, and never switch into abstract university proof tone unless this curriculum's secondary paper asks for it. One level only — do not mix.",
  ].join(" ");
}

export type PromptRequest = {
  question?: string;
  latex?: string;
  track?: string;
  language: LessonLanguage;
  decision: CurriculumDecision;
  /** CAS / verifier findings from a previous attempt (repair pass). */
  feedback?: string;
};

export function buildSolverPrompt(request: PromptRequest): string {
  const user = [
    request.latex ? `LaTeX: ${request.latex}` : "",
    request.question ? `Question: ${request.question}` : "Solve the problem in the image.",
    `Track hint: ${request.track ?? "auto"}`,
    `Curriculum: ${request.decision.curriculum} (${request.decision.source})`,
  ]
    .filter(Boolean)
    .join("\n");
  const repair = request.feedback
    ? `\n\nA deterministic CAS check REJECTED your previous answer:\n${request.feedback}\nRedo the affected parts from scratch (recompute, do not patch numbers), re-run every check, and return the full corrected JSON.`
    : "";
  return [
    SOLVER_SYSTEM_PROMPT,
    curriculumStyleBlock(request.decision.curriculum, request.decision.level),
    levelBlock(request.decision),
    languageBlock(request.language),
    `${user}${repair}`,
  ].join("\n\n");
}
