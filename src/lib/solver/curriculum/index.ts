import { AP_STYLE } from "./ap.ts";
import { CAMBRIDGE_STYLE } from "./cambridge.ts";
import { FRENCH_BAC_STYLE } from "./frenchBac.ts";
import { GENERAL_STYLE } from "./general.ts";
import { IB_STYLE } from "./ib.ts";
import { LEBANESE_STYLE } from "./lebanese.ts";
import { SAT_ACT_STYLE } from "./satAct.ts";
import type { CurriculumStyle, SolverCurriculum, SolverLevel } from "./types.ts";
import { UNIVERSITY_STYLE } from "./university.ts";

export { detectCurriculum, type CurriculumDecision, type CurriculumInput } from "./detect.ts";
export { SOLVER_CURRICULA, isSolverCurriculum, type CurriculumStyle, type SolverCurriculum, type SolverLevel } from "./types.ts";

export const CURRICULUM_STYLES: Readonly<Record<SolverCurriculum, CurriculumStyle>> = {
  lebanese: LEBANESE_STYLE,
  french_bac: FRENCH_BAC_STYLE,
  ib: IB_STYLE,
  ap: AP_STYLE,
  sat_act: SAT_ACT_STYLE,
  cambridge: CAMBRIDGE_STYLE,
  university: UNIVERSITY_STYLE,
  general: GENERAL_STYLE,
};

/** Prompt block: how a student of this system must write the answer on the exam. */
export function curriculumStyleBlock(curriculum: SolverCurriculum, level: SolverLevel): string {
  const style = CURRICULUM_STYLES[curriculum];
  const extra = level === "university" && curriculum !== "university" ? UNIVERSITY_STYLE.rules : [];
  const rules = [...style.rules, ...extra].map((rule, index) => `${index + 1}. ${rule}`).join("\n");
  return `CURRICULUM STYLE — ${style.labelEn} (level: ${level}). Write the solution exactly the way a student of this system must write it on the exam:\n${rules}`;
}
