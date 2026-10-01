import type { SolverCurriculum } from "@/lib/solver/curriculum/types";

/** Exam styles the student can pick in the solver ("auto" = detect from the question, track and platform). */
export const SOLVER_CURRICULUM_CHOICES = ["auto", "lebanese", "french_bac", "ib", "ap", "sat_act", "cambridge", "university"] as const;
export type SolverCurriculumChoice = (typeof SOLVER_CURRICULUM_CHOICES)[number];

/** Every id the result page may show (`general` = no specific system detected). */
export type SolverStyleId = SolverCurriculumChoice | SolverCurriculum;
