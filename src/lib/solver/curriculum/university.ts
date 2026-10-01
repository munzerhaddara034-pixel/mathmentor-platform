import type { CurriculumStyle } from "./types";

/** University mathematics (Calculus, linear algebra, ODE, analysis, algebra, probability). */
export const UNIVERSITY_STYLE: CurriculumStyle = {
  id: "university",
  labelEn: "University (rigorous proof style)",
  rules: [
    "Proof style: 'Let …', quantifiers explicit, one claim per line, each inference justified; name the proof method (direct, contradiction, induction) and end with ∎.",
    "State every theorem you use IN FULL with its hypotheses (e.g. Bolzano–Weierstrass: every bounded real sequence has a convergent subsequence; completeness of ℝ: every non-empty set bounded above has a supremum).",
    "Linear algebra: show det(A - \\lambda I) expanded, the row-reduced kernel system for EACH eigenvalue, the basis vectors, then check A v = \\lambda v for every vector and P D = A P.",
    "ODE: characteristic equation, homogeneous solution, justified form of the particular solution (resonance ⇒ multiply by x), constants from the initial conditions as a displayed linear system, then substitute y back into the equation AND the conditions.",
    "Put proof prose in the explanation fields; keep latex fields for the mathematics (short \\text{…} connectors only).",
  ],
};
