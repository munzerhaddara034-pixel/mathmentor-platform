/**
 * Solve → deterministic CAS check → (strong tier) one repair pass → synchronous AI verification pass.
 * Middle school / SAT stay on the fast path (CAS only; the verifier runs in the background).
 */
import { NEEDS_REVIEW_AR } from "@/lib/agent/persona";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { casFailureSummary, runCasChecks, type CasReport } from "./cas/index";
import { decideFor, solveWithGemini, type GeminiSolveRequest } from "./llm";
import type { MathSolution, SolverMeta, SolverVerification } from "./types";
import { verifySolution, type SolutionVerdict } from "./verify";

function cas(solution: MathSolution, question: string): CasReport {
  return runCasChecks({
    question,
    checks: solution.solverMeta?.checks,
    finalAnswerLatex: solution.finalAnswerLatex,
    stepLatex: solution.steps.map((step) => step.latex),
  });
}

function casSummary(report: CasReport): NonNullable<SolverMeta["cas"]> {
  return {
    passed: report.passed,
    failed: report.failed,
    skipped: report.skipped,
    failures: report.outcomes.filter((item) => item.status === "fail").map((item) => `[${item.kind}] ${item.detail}`),
  };
}

function casReportText(report: CasReport): string {
  return report.outcomes
    .filter((item) => item.status !== "skipped")
    .map((item) => `${item.status.toUpperCase()} [${item.kind}] ${item.detail}`)
    .join("\n");
}

function applyVerdict(solution: MathSolution, verdict: SolutionVerdict, report: CasReport): SolverVerification {
  const corrected = verdict.correctedFinalAnswerLatex || verdict.correctedFinalAnswer;
  if (verdict.status === "verified" && report.failed === 0) {
    solution.needsReview = false;
    return { status: "verified", noteAr: verdict.noteAr, mode: "sync", applied: false };
  }
  if (verdict.status === "needs_fix" && corrected) {
    const latex = formatLebaneseEquation(verdict.correctedFinalAnswerLatex || solution.finalAnswerLatex);
    solution.steps.push({
      title: "Correction — Youssef (AI tutor), second check",
      titleFr: "Correction — Youssef (tuteur IA), seconde vérification",
      titleAr: "تصحيح — يوسف (معلّم بالذكاء الاصطناعي)، تحقّق ثانٍ",
      examVerbEn: "Check",
      latex,
      explanationEn: verdict.issues.join(" ") || verdict.noteAr,
      explanationFr: "",
      explanationAr: verdict.noteAr,
      boxed: true,
    });
    solution.finalAnswerLatex = latex;
    if (verdict.correctedFinalAnswer) solution.finalAnswer = verdict.correctedFinalAnswer;
    solution.needsReview = true;
    solution.warning = `${NEEDS_REVIEW_AR} — corrected by the AI second check before delivery.`;
    return { status: "needs_fix", noteAr: verdict.noteAr, mode: "sync", applied: true };
  }
  solution.needsReview = true;
  const reason = report.failed ? casFailureSummary(report).slice(0, 240) : verdict.noteAr.slice(0, 240);
  solution.warning = `${NEEDS_REVIEW_AR} — ${reason}`;
  return { status: verdict.status === "needs_fix" ? "needs_fix" : "unverified", noteAr: verdict.noteAr, mode: "sync", applied: false };
}

export async function solveAndVerify(request: GeminiSolveRequest): Promise<MathSolution> {
  const started = Date.now();
  const decision = decideFor(request);
  const question = `${request.question ?? ""}\n${request.latex ?? ""}`;
  let solution = await solveWithGemini({ ...request, decision });
  if (solution.needsRetake || !solution.solverMeta) return solution;
  const meta: SolverMeta = solution.solverMeta;
  let report = cas(solution, question);

  // One repair pass whenever the CAS rejects the answer (both tiers; fast tier stays on fast models).
  if (report.failed > 0) {
    try {
      const repaired = await solveWithGemini({ ...request, decision, feedback: casFailureSummary(report) });
      const second = cas(repaired, question);
      meta.calls.push(...(repaired.solverMeta?.calls ?? []));
      if (!repaired.needsRetake && second.failed <= report.failed) {
        solution = repaired;
        report = second;
        meta.repaired = true;
        meta.checks = repaired.solverMeta?.checks;
        meta.model = repaired.solverMeta?.model ?? meta.model;
      }
    } catch (error) {
      console.warn("[mathmentor] repair pass skipped:", error instanceof Error ? error.message : error);
    }
  }
  meta.cas = casSummary(report);
  solution.solverMeta = meta;

  if (meta.tier === "strong") {
    const verdict = await verifySolution(
      { ...solution, question: request.question || request.latex || "", latex: request.latex, track: solution.track },
      { tier: "strong", casReport: casReportText(report), university: meta.level === "university" },
    );
    meta.calls.push(...verdict.calls);
    meta.verification = applyVerdict(solution, verdict, report);
  } else if (report.failed > 0) {
    solution.needsReview = true;
    solution.warning = `${NEEDS_REVIEW_AR} — ${casFailureSummary(report).slice(0, 240)}`;
  }
  meta.costUsd = meta.calls.reduce((sum, call) => sum + call.costUsd, 0);
  meta.totalMs = Date.now() - started;
  return solution;
}
