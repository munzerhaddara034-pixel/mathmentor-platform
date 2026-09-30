import type { CurriculumStyle } from "./types";

/** Fallback when no exam system is selected or detected. */
export const GENERAL_STYLE: CurriculumStyle = {
  id: "general",
  labelEn: "General (clear exam-style working)",
  rules: [
    "Numbered sub-questions, each with method, working and a boxed result; name the rule or theorem used.",
    "Exact values first, then decimals if asked; units in final answers; one check by substitution.",
  ],
};
