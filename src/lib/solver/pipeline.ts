/**
 * Solve → deterministic CAS check → (strong tier) one repair pass → AI verification pass.
 * Middle school / SAT stay on the fast path (CAS only; the verifier runs in the background).
 *
 * Every provider call is clamped to one request-wide deadline (see budget.ts): the answer is always
 * delivered inside the platform's request timeout, and the second (verification) pass moves to the
 * background when there is no room left for it — instead of the request dying with no answer at all.
 */
import { NEEDS_REVIEW_AR } from "@/lib/agent/persona";
import { formatLebaneseEquation } from "@/lib/math/lebaneseEquationFormat";
import { canStartCall, createDeadline, primaryBudgetMs, shouldVerifySynchronously, SOLVER_TOTAL_BUDGET_MS, type SolverDeadline } from "./budget";
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
      title: "Correction — Dr. Mohamed · Munzer's assistant (AI tutor), second check",
      titleFr: "Correction — Dr Mohamed · assistant de Munzer (tuteur IA), seconde vérification",
      titleAr: "تصحيح — الدكتور محمد · مساعد منذر (معلّم بالذكاء الاصطناعي)، تحقّق ثانٍ",
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

export async function solveAndVerify(
  request: GeminiSolveRequest,
  deadline: SolverDeadline = createDeadline(SOLVER_TOTAL_BUDGET_MS),
  options: { reserveMs?: number } = {},
): Promise<MathSolution> {
  const started = Date.now();
  const decision = decideFor(request);
  const question = `${request.question ?? ""}\n${request.latex ?? ""}`;
  // The reserve keeps a window open for the fast rescue provider when Gemini runs out of time.
  const reserve = options.reserveMs ?? 0;
  let solution = await solveWithGemini({ ...request, decision }, { deadlineMs: primaryBudgetMs(deadline.remaining(), reserve) });
  if (solution.needsRetake || !solution.solverMeta) return solution;
  const meta: SolverMeta = solution.solverMeta;
  let report = cas(solution, question);

  // One repair pass whenever the CAS rejects the answer — but only if the request still has room for it.
  if (report.failed > 0 && canStartCall(primaryBudgetMs(deadline.remaining(), reserve))) {
    try {
      const repaired = await solveWithGemini({ ...request, decision, feedback: casFailureSummary(report) }, { deadlineMs: primaryBudgetMs(deadline.remaining(), reserve) });
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
    if (shouldVerifySynchronously(deadline.remaining())) {
      const verdict = await verifySolution(
        { ...solution, question: request.question || request.latex || "", latex: request.latex, track: solution.track },
        { tier: "strong", casReport: casReportText(report), university: meta.level === "university", deadlineMs: deadline.remaining() },
      );
      meta.calls.push(...verdict.calls);
      meta.verification = applyVerdict(solution, verdict, report);
    } else {
      // No room for a second pass: deliver the answer now and let the background verifier audit it
      // (recordSolution schedules it whenever the mode is not "sync").
      meta.verification = {
        status: "unverified",
        noteAr: `${NEEDS_REVIEW_AR} — التحقق الآلي يجري في الخلفية لتسليم الحل بسرعة.`,
        mode: "background",
        applied: false,
      };
    }
  } else if (report.failed > 0) {
    solution.needsReview = true;
    solution.warning = `${NEEDS_REVIEW_AR} — ${casFailureSummary(report).slice(0, 240)}`;
  }
  meta.costUsd = meta.calls.reduce((sum, call) => sum + call.costUsd, 0);
  meta.totalMs = Date.now() - started;
  return solution;
}