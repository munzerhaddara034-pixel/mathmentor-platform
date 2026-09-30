/** Exam systems whose answer-writing conventions the solver reproduces. */
export const SOLVER_CURRICULA = [
  "lebanese",
  "french_bac",
  "ib",
  "ap",
  "sat_act",
  "cambridge",
  "university",
  "general",
] as const;

export type SolverCurriculum = (typeof SOLVER_CURRICULA)[number];

/** Difficulty tier: drives model choice, token caps and synchronous verification. */
export type SolverLevel = "middle" | "secondary" | "university";

export type CurriculumStyle = {
  id: SolverCurriculum;
  labelEn: string;
  /** Rules for how a student of this system must WRITE the answer on the exam. */
  rules: readonly string[];
};

export function isSolverCurriculum(value: unknown): value is SolverCurriculum {
  return typeof value === "string" && (SOLVER_CURRICULA as readonly string[]).includes(value);
}
