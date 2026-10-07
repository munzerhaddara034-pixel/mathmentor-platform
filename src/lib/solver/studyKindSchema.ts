/**
 * Tolerant schema for the model's classification labels (`studyKind`, asymptote kind).
 *
 * The solver prompt asks the model to classify the question, and models legitimately answer with a
 * neighbouring label: an integral question comes back as "integrals", a derivative as "derivatives",
 * a trig equation as "trigonometry". Those labels used to fail the whole Zod parse, so a complete and
 * correct solution was discarded and the student got an error instead of an answer.
 *
 * The label is only an assembly hint for the study script — never a correctness claim — so it is
 * coerced through an alias map and can never reject a solution. Anything unrecognisable becomes
 * "general", which assembles the neutral path.
 */
import { z } from "zod";
import type { StudyKind } from "./types";

export const STUDY_KINDS = ["real_function", "geometry", "complex", "probability", "algebra", "limits", "general"] as const;

/** Labels a model may reasonably use for each curriculum family. */
const STUDY_KIND_ALIASES: Record<string, StudyKind> = {
  integral: "real_function",
  integrals: "real_function",
  integration: "real_function",
  antiderivative: "real_function",
  derivative: "real_function",
  derivatives: "real_function",
  differentiation: "real_function",
  calculus: "real_function",
  function: "real_function",
  functions: "real_function",
  function_study: "real_function",
  exponential: "real_function",
  exponential_function: "real_function",
  logarithm: "real_function",
  logarithmic: "real_function",
  equation: "algebra",
  equations: "algebra",
  system: "algebra",
  systems: "algebra",
  inequality: "algebra",
  inequalities: "algebra",
  polynomial: "algebra",
  polynomials: "algebra",
  sequence: "algebra",
  sequences: "algebra",
  series: "algebra",
  sums: "algebra",
  trigonometry: "algebra",
  trig: "algebra",
  trigonometric: "algebra",
  trigonometric_equation: "algebra",
  matrices: "algebra",
  matrix: "algebra",
  linear_algebra: "algebra",
  statistics: "probability",
  stats: "probability",
  combinatorics: "probability",
  counting: "probability",
  vector: "geometry",
  vectors: "geometry",
  coordinates: "geometry",
  plane_geometry: "geometry",
  analytic_geometry: "geometry",
  conics: "geometry",
  complex_numbers: "complex",
  continuity: "limits",
  asymptotes: "limits",
  limits_and_continuity: "limits",
  arithmetic: "general",
  numbers: "general",
  number_theory: "general",
};

/** Maps any model label onto a supported study kind; unknown strings degrade to "general". */
export function coerceStudyKind(value: unknown): StudyKind | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return undefined;
  if ((STUDY_KINDS as readonly string[]).includes(key)) return key as StudyKind;
  return STUDY_KIND_ALIASES[key] ?? "general";
}

export const studyKindSchema = z.preprocess(coerceStudyKind, z.enum(STUDY_KINDS).optional());

export const ASYMPTOTE_KINDS = ["vertical", "horizontal", "oblique"] as const;

const ASYMPTOTE_ALIASES: Record<string, (typeof ASYMPTOTE_KINDS)[number]> = {
  vertical: "vertical",
  vert: "vertical",
  vertical_asymptote: "vertical",
  horizontal: "horizontal",
  horiz: "horizontal",
  horizontal_asymptote: "horizontal",
  oblique: "oblique",
  slant: "oblique",
  slanted: "oblique",
  diagonal: "oblique",
  affine: "oblique",
  slanted_asymptote: "oblique",
  oblique_asymptote: "oblique",
};

/** Lower-cases and maps an asymptote kind; returns undefined for anything unrecognisable. */
export function coerceAsymptoteKind(value: unknown): (typeof ASYMPTOTE_KINDS)[number] | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((ASYMPTOTE_KINDS as readonly string[]).includes(key)) return key as (typeof ASYMPTOTE_KINDS)[number];
  return ASYMPTOTE_ALIASES[key];
}

export const asymptoteSchema = z.object({
  kind: z.preprocess(coerceAsymptoteKind, z.enum(ASYMPTOTE_KINDS)),
  equation: z.string(),
});

/**
 * Keeps every usable asymptote and drops only the malformed ones, so one bad entry cannot remove the
 * good list and can never fail the whole solution. A non-array value is ignored entirely.
 */
export const asymptotesSchema = z.preprocess(
  (value) => {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((entry) => {
      const parsed = asymptoteSchema.safeParse(entry);
      return parsed.success ? [parsed.data] : [];
    });
  },
  z.array(asymptoteSchema).optional(),
);
