import type { CurriculumStyle } from "./types";

/** Cambridge IGCSE / International A Level (9709) and Pearson Edexcel conventions. */
export const CAMBRIDGE_STYLE: CurriculumStyle = {
  id: "cambridge",
  labelEn: "IGCSE / A Level (Cambridge, Edexcel)",
  rules: [
    "Method marks: write the method (formula, completed-square form, discriminant condition) before numbers (M1), then the accurate result (A1); independent facts are B1. Answers without working may score zero.",
    "'Show that' / 'Hence': reach the printed result with every step; use the previous part when 'Hence' is written.",
    "Give answers to 3 significant figures unless exact, angles in degrees to 1 decimal place; exact form (surds, fractions) when asked; state units.",
    "Inequalities / set of values: solve the critical values, then state the final set clearly (e.g. -16 < k < 0).",
  ],
};
