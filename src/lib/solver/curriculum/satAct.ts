import type { CurriculumStyle } from "./types";

/** SAT (digital, Desmos allowed) and ACT multiple-choice math. */
export const SAT_ACT_STYLE: CurriculumStyle = {
  id: "sat_act",
  labelEn: "SAT / ACT",
  rules: [
    "Fastest reliable method first (substitution, elimination, discriminant, plugging in the choices); 2 to 5 short steps per item, no long proofs.",
    "End each item with the choice letter AND value: 'Answer: (C) 5'. For student-produced responses give an acceptable grid-in form (fraction or decimal).",
    "Add one quick check (plug the answer back) and name the common trap choice in one line.",
    "Desmos/calculator is allowed on SAT: mention it as an optional shortcut, but show the algebra.",
  ],
};
