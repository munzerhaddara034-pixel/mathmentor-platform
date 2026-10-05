import { AP_STYLE } from "./ap.ts";
import { CAMBRIDGE_STYLE } from "./cambridge.ts";
import { FRENCH_BAC_STYLE } from "./frenchBac.ts";
import { GENERAL_STYLE } from "./general.ts";
import { IB_STYLE } from "./ib.ts";
import { LEBANESE_STYLE } from "./lebanese.ts";
import { SAT_ACT_STYLE } from "./satAct.ts";
import type { CurriculumStyle, SolverCurriculum, SolverLevel } from "./types.ts";
import { UNIVERSITY_STYLE } from "./university.ts";

export { detectCurriculum, levelFromTrack, levelFromCurriculum, trackForLevel, type CurriculumDecision, type CurriculumInput } from "./detect.ts";
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
  // Middle school: keep only the middle-friendly rule lines (Brevet / short steps / units); never append university rules.
  let rulesList = [...style.rules];
  if (level === "middle") {
    rulesList = rulesList.filter((rule) => /brevet|short numbered|units in every|verify a system|approximations/i.test(rule) || curriculum === "general");
    if (!rulesList.length) {
      rulesList = [
        "Short numbered steps a Grade 7–9 student can copy; units in every final answer.",
        "Verify a system by substituting into BOTH equations; write 'Hence …' before the result.",
      ];
    }
  } else if (level === "university" && curriculum !== "university") {
    rulesList = [...rulesList, ...UNIVERSITY_STYLE.rules];
  }
  const rules = rulesList.map((rule, index) => `${index + 1}. ${rule}`).join("\n");
  const hard =
    level === "middle"
      ? "Use middle-school curricula only (Brevet / Grades 7–9). Forbidden in this answer: Terminale/Bac full function studies, IB HL proofs, university abstract algebra."
      : level === "university"
        ? "University proof style only. Forbidden: middle-school oversimplification and secondary barème shortcuts."
        : "Secondary / Bac style with this system's mark scheme only. Forbidden: middle-school baby steps and university-only abstract proofs (unless the paper asks).";
  return `CURRICULUM STYLE — ${style.labelEn} (level: ${level}). Write the solution exactly the way a student of this system must write it on the exam:\n${rules}\nHARD SEPARATION: ${hard}`;
}
