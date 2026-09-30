/** Machine-checkable claims the solver emits in its JSON "checks" array (mathjs syntax strings). */
import { z } from "zod";

const expr = z.union([z.string(), z.number()]).transform((value) => String(value));
const matrix = z.array(z.array(expr)).min(1);

export const claimSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("linear_system"), equations: z.array(z.string()).min(1), solution: z.record(expr) }),
  z.object({ kind: z.literal("eigenpair"), matrix, value: expr, vector: z.array(expr).min(1) }),
  z.object({ kind: z.literal("diagonalization"), matrix, P: matrix, D: matrix }),
  z.object({
    kind: z.literal("ode"),
    lhs: z.string(),
    rhs: z.string(),
    solution: z.string(),
    variable: z.string().default("x"),
    conditions: z.array(z.object({ order: z.number().int().min(0).max(3), at: expr, value: expr })).default([]),
  }),
  z.object({ kind: z.literal("integral"), integrand: z.string(), variable: z.string().default("x"), lower: expr, upper: expr, value: expr }),
  z.object({ kind: z.literal("limit"), expr: z.string(), variable: z.string().default("x"), to: expr, value: expr }),
  z.object({ kind: z.literal("derivative"), fn: z.string(), variable: z.string().default("x"), derivative: z.string() }),
  z.object({ kind: z.literal("root"), expr: z.string(), variable: z.string().default("x"), value: expr, lower: expr.optional(), upper: expr.optional() }),
  z.object({ kind: z.literal("equal"), left: expr, right: expr, variable: z.string().optional() }),
]);

export type Claim = z.infer<typeof claimSchema>;

export type CheckOutcome = {
  kind: Claim["kind"] | "question_matrix" | "final_vs_steps" | "unparsed";
  status: "pass" | "fail" | "skipped";
  detail: string;
};

/** Parse the raw array leniently: malformed entries are reported as skipped, never thrown. */
export function parseClaims(raw: unknown): { claims: Claim[]; skipped: CheckOutcome[] } {
  const claims: Claim[] = [];
  const skipped: CheckOutcome[] = [];
  if (!Array.isArray(raw)) return { claims, skipped };
  for (const item of raw.slice(0, 24)) {
    const parsed = claimSchema.safeParse(item);
    if (parsed.success) claims.push(parsed.data);
    else skipped.push({ kind: "unparsed", status: "skipped", detail: "unparseable check entry" });
  }
  return { claims, skipped };
}
