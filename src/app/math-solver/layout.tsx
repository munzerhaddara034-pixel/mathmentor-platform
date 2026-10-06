export const dynamic = "force-dynamic";

/**
 * The solver is open to visitors: instead of a sign-in wall, `POST /api/solve-math` gives a guest a
 * small per-day trial budget and answers with a sign-up card once it runs out. Saved history, longer
 * questions and unlimited solving still require an account with an active plan.
 *
 * Result pages stay unindexed through their own page metadata; the solver page itself is indexable
 * because it is the landing surface for the free trial.
 */
export default function MathSolverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
