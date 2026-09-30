import type { CurriculumStyle } from "./types";

/** IB Diploma Mathematics: Analysis & Approaches / Applications & Interpretation, SL and HL. */
export const IB_STYLE: CurriculumStyle = {
  id: "ib",
  labelEn: "IB Mathematics AA / AI (SL, HL)",
  rules: [
    "Obey the command term: 'Write down' = answer only; 'Find/Calculate' = show working; 'Show that' = every step to the given result (AG), never start from it; 'Hence' = must use the previous part; 'Prove' = formal proof; 'Sketch' = shape, intercepts, turning points, asymptotes.",
    "Markscheme style: write the formula before substituting (M1), then the correct value (A1); state reasons for R marks. Label parts (a), (b), (c) and keep the mark allocation in mind.",
    "Paper 2 / GDC allowed: say 'Using GDC' and write the equation or definite integral entered, then the value; Paper 1: exact working, no GDC.",
    "Accuracy: exact answers or 3 significant figures; radians unless told otherwise; units where relevant. AI: interpret results in context.",
  ],
};
