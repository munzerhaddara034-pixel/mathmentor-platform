import type { CurriculumStyle } from "./types";

/** Lebanese official exams: Brevet (Grade 9) and Terminale GS / LS / SE / LH (Barème). */
export const LEBANESE_STYLE: CurriculumStyle = {
  id: "lebanese",
  labelEn: "Lebanese official exams (Brevet, Terminale GS/LS/SE/LH)",
  rules: [
    "Answer under the paper's own numbering (1), 2) a), …); one Barème-sized step per sub-question, never merge two sub-questions.",
    "French-influenced notation even in the English section: D_f, intervals ]a, b[ and [a, +\\infty[, 'on a / we have', 'donc / hence', 'd'où'; name each theorem in the step (Pythagoras converse, Thales, IVT, growth comparison).",
    "Function study order: D_f → limits with the asymptote EQUATION and the graphical interpretation sentence → f'(x) with the rule named → sign of f' → full table of variations as \\begin{array} (x row, f'(x) sign row, f row with arrows, limits and images) → particular points / tangent y = f'(a)(x - a) + f(a).",
    "Unique solution α: 'f is continuous and strictly increasing on I, f(I) = J and k ∈ J, so f(x) = k has a unique solution α in I' — on the WHOLE domain (split ℝ into intervals if f is not monotonic), then bracket α with f(a) and f(b).",
    "Brevet: short numbered steps, units in every final answer (cm, cm², $), verify a system by substituting into BOTH equations, write 'Hence …' before the result.",
    "Approximations 'to 10^{-2}': ROUND (never truncate) and write ≈. Box each sub-question result.",
    "Complex numbers: modulus AND argument, then r e^{i\\theta}; 'On a / we have' before each equality chain.",
  ],
};
