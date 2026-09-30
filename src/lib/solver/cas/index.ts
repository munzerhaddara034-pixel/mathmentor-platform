/** Deterministic CAS pass over a solver answer. Pure, synchronous, never throws. */
import { checkDerivative, checkEqual, checkIntegral, checkLimit, checkOde, checkRoot } from "./calculus.ts";
import { parseClaims, type CheckOutcome, type Claim } from "./claims.ts";
import { checkFinalAgainstSteps } from "./consistency.ts";
import { checkDiagonalization, checkEigenpair, checkLinearSystem, checkMatricesAgainstQuestion } from "./linear.ts";

export type { CheckOutcome, Claim } from "./claims.ts";

export type CasReport = {
  outcomes: CheckOutcome[];
  passed: number;
  failed: number;
  skipped: number;
};

function runClaim(claim: Claim): CheckOutcome {
  switch (claim.kind) {
    case "linear_system":
      return checkLinearSystem(claim);
    case "eigenpair":
      return checkEigenpair(claim);
    case "diagonalization":
      return checkDiagonalization(claim);
    case "ode":
      return checkOde(claim);
    case "integral":
      return checkIntegral(claim);
    case "limit":
      return checkLimit(claim);
    case "derivative":
      return checkDerivative(claim);
    case "root":
      return checkRoot(claim);
    case "equal":
      return checkEqual(claim);
  }
}

export type CasInput = {
  question: string;
  checks: unknown;
  finalAnswerLatex: string;
  stepLatex: string[];
};

export function runCasChecks(input: CasInput): CasReport {
  const { claims, skipped } = parseClaims(input.checks);
  const outcomes: CheckOutcome[] = [...skipped];
  for (const claim of claims) {
    try {
      outcomes.push(runClaim(claim));
    } catch (error) {
      outcomes.push({ kind: claim.kind, status: "skipped", detail: error instanceof Error ? error.message : "check crashed" });
    }
  }
  outcomes.push(...checkMatricesAgainstQuestion(input.question, claims));
  outcomes.push(...checkFinalAgainstSteps(input.finalAnswerLatex, input.stepLatex));
  return {
    outcomes,
    passed: outcomes.filter((item) => item.status === "pass").length,
    failed: outcomes.filter((item) => item.status === "fail").length,
    skipped: outcomes.filter((item) => item.status === "skipped").length,
  };
}

/** Short English list of failures for the repair prompt and the verifier. */
export function casFailureSummary(report: CasReport): string {
  return report.outcomes
    .filter((item) => item.status === "fail")
    .map((item, index) => `${index + 1}. [${item.kind}] ${item.detail}`)
    .join("\n");
}
