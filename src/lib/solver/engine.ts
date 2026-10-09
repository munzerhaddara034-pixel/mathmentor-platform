import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId } from "@/lib/ids";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import { hasHeyGenKey } from "@/lib/studio/heygen";
import { newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { attachDemoMedia } from "./assemble";
import { canStartCall, createDeadline, SOLVER_RESCUE_RESERVE_MS, type SolverDeadline } from "./budget";
import { recordOpsError, scrubErrorText } from "@/lib/ops/errorLog";
import { demoSolve, type SolveRequest } from "./demoSolver";
import { deepseekConfigIssue, deepseekSolverKey, demoFallback, hasGeminiKey, openaiSolverKey, solveWithDeepSeek, solveWithOpenAI } from "./llm";
import { solveAndVerify } from "./pipeline";
import { looksLikeMath, retakeSolution } from "./retake";
import { saveMathQuery } from "./store";
import { scheduleSolutionVerification } from "./verify";
import type { MathQueryRecord, MathSolution } from "./types";
import type { PublicUser } from "@/lib/auth/store";
import { readUploadFile, uploadFileName, type UploadRejection } from "@/lib/security/uploads";

export type EngineInput = SolveRequest & {
  imageBase64?: string;
  mimeType?: string;
  imageUrl?: string;
  /** Solver curriculum chosen in the form ("auto" = detect). */
  curriculum?: string;
  /** Platform curriculum (lebanese, ib, cambridge, ap, sat, saudi-gcc). */
  platformCurriculum?: string;
};

/** Stored notebook photo. The extension comes from the sniffed type, never from the client name. */
export type SavedImage = {
  ok: true;
  imageUrl: string;
  imageName: string;
  mimeType: string;
  imageBase64: string;
};

/**
 * Store a notebook photo after the shared upload policy (byte cap, magic bytes, our extension).
 * Rejections are returned, not thrown, so the route can answer 413/415 without storing anything.
 */
export async function persistUploadedImage(file: File): Promise<SavedImage | UploadRejection> {
  const read = await readUploadFile(file, ["image"]);
  if (!read.ok) return read;
  const dir = path.join(process.cwd(), "public", "uploads", "math");
  await mkdir(dir, { recursive: true });
  const name = uploadFileName(read.ext);
  await writeFile(path.join(dir, name), read.bytes);
  return {
    ok: true,
    imageUrl: `/uploads/math/${name}`,
    imageName: read.originalName,
    mimeType: read.mime,
    imageBase64: read.bytes.toString("base64"),
  };
}

export async function runMathSolver(input: EngineInput): Promise<MathSolution> {
  const request: SolveRequest = {
    question: input.question,
    latex: input.latex,
    language: input.language,
    track: input.track,
    imageName: input.imageName,
  };
  const typed = `${input.question ?? ""} ${input.latex ?? ""}`.trim();
  const typedIsMath = looksLikeMath(typed);
  // One deadline for the whole request: every provider call is clamped to it (see budget.ts).
  const deadline = createDeadline();
  // When a fast rescue provider is configured, hold a window open for it (see SOLVER_RESCUE_RESERVE_MS).
  const configIssues: string[] = [];
  const deepseekIssue = deepseekConfigIssue();
  if (deepseekIssue) configIssues.push(deepseekIssue);
  const rescueConfigured = Boolean(deepseekSolverKey() || openaiSolverKey());
  const reserveMs = rescueConfigured ? SOLVER_RESCUE_RESERVE_MS : 0;

  if (hasGeminiKey() && (typed || input.imageBase64)) {
    try {
      return await solveAndVerify({
        ...request,
        imageBase64: input.imageBase64,
        mimeType: input.mimeType,
        curriculum: input.curriculum,
        platformCurriculum: input.platformCurriculum,
      }, deadline, { reserveMs });
    } catch (error) {
      if (input.imageBase64 && !typedIsMath) {
        return retakeSolution({
          question: typed,
          language: request.language,
          imageName: request.imageName,
          source: "demo",
        });
      }
      console.warn("[mathmentor] Gemini solve failed:", error instanceof Error ? error.message : error);
      const rescueFailures: string[] = [...configIssues];
      const rescued = await solveWithFastProvider(request, typedIsMath, Boolean(input.imageBase64), deadline, rescueFailures);
      if (rescued) return rescued;
      const reason = rescueFailures.join(" | ").slice(0, 180);
      const base = "يحتاج مراجعة — the AI tutor is busy right now; this is a basic offline answer. Please try again in a minute.";
      return demoFallback(request, reason ? `${base} [${reason}]` : base);
    }
  }

  const fast = await solveWithFastProvider(request, typedIsMath, Boolean(input.imageBase64), deadline);
  if (fast) return fast;

  if (input.imageBase64 && !typedIsMath) {
    return retakeSolution({
      question: typed,
      language: request.language,
      imageName: request.imageName,
      source: "demo",
    });
  }

  const solution = demoSolve(request);
  if (!hasGeminiKey() && input.imageBase64 && typedIsMath) {
    solution.warning =
      "No GEMINI_API_KEY — solved the typed given. Photo OCR needs Gemini Vision; the image was not invented from.";
  } else if (!hasGeminiKey() && !openaiSolverKey() && !deepseekSolverKey()) {
    solution.warning =
      solution.warning ||
      "No GEMINI_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY — deterministic Lebanese curriculum demo solver.";
  }
  return solution;
}

function syncedAudit(solution: MathSolution): MathQueryRecord["auditStatus"] {
  const verification = solution.solverMeta?.verification;
  if (verification?.mode !== "sync" || verification.status === "unverified") return "pending";
  return verification.status;
}

/** `user` may be the guest trial identity (id/name/email only) — guests have no account record. */
export async function recordSolution(
  user: Pick<PublicUser, "id" | "name" | "email">,
  input: EngineInput,
  solution: MathSolution,
): Promise<MathQueryRecord> {
  const demoVideo = !hasHeyGenKey() && !solution.needsRetake;
  const timeline = attachDemoMedia(solution.timeline, demoVideo ? DEMO_AVATAR_VIDEO : solution.timeline.media?.videoUrl);
  let heygenJobId: string | undefined;
  let videoStatus: MathQueryRecord["videoStatus"] = solution.needsRetake ? "none" : demoVideo ? "demo" : "none";
  let videoUrl = demoVideo ? DEMO_AVATAR_VIDEO : undefined;

  if (demoVideo) {
    const job = await upsertHeyGenJob(
      newQueuedJob({
        lessonId: `math-${createId("q")}`,
        title: `MathMentor solver · ${solution.topic}`,
        script: solution.avatarScript.en,
        notes: solution.summary,
        mathExamples: solution.finalAnswerLatex,
        language: solution.language === "ar" ? "ar" : solution.language,
        speed: 1,
        timelineJson: JSON.stringify(timeline),
        demo: true,
      }),
    );
    heygenJobId = job.id;
    videoStatus = "demo";
    videoUrl = DEMO_AVATAR_VIDEO;
    timeline.media = { ...(timeline.media ?? {}), heygenJobId: job.id, videoUrl: DEMO_AVATAR_VIDEO, studentEnabled: true };
  }

  const record = await saveMathQuery({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    question: input.question || input.latex || (input.imageName ? `(image) ${input.imageName}` : "(empty)"),
    latex: input.latex,
    imageUrl: input.imageUrl,
    imageName: input.imageName,
    language: solution.language,
    track: solution.track,
    topic: solution.topic,
    topicTag: solution.topicTag,
    summary: solution.summary,
    given: solution.given,
    examTip: solution.examTip,
    studyKind: solution.studyKind,
    asymptotes: solution.asymptotes,
    finalAnswer: solution.finalAnswer,
    finalAnswerLatex: solution.finalAnswerLatex,
    steps: solution.steps,
    avatarScript: solution.avatarScript,
    canvasTimeline: solution.canvasTimeline,
    timeline,
    source: solution.source,
    warning: solution.warning,
    needsRetake: solution.needsRetake,
    retakeMessageEn: solution.retakeMessageEn,
    retakeMessageAr: solution.retakeMessageAr,
    curriculum: solution.curriculum,
    needsReview: solution.needsReview,
    solverMeta: solution.solverMeta,
    auditStatus: syncedAudit(solution),
    auditNote: solution.solverMeta?.verification?.mode === "sync" ? solution.solverMeta.verification.noteAr : undefined,
    videoStatus,
    heygenJobId,
    videoUrl,
  });
  // AI verification pass (مدقّق الحلول): background second check; failures fall back to the current "pending" audit.
  scheduleSolutionVerification(record);
  return record;
}

/**
 * Fast rescue providers used when Gemini is missing, slow or failing: DeepSeek first (cheap and quick),
 * then OpenAI. Typed questions only — photo OCR needs Gemini Vision.
 */
async function solveWithFastProvider(
  request: SolveRequest,
  typedIsMath: boolean,
  hasImage: boolean,
  deadline: SolverDeadline,
  failures: string[] = [],
): Promise<MathSolution | null> {
  if (!typedIsMath || hasImage || !canStartCall(deadline.remaining())) return null;
  if (deepseekSolverKey()) {
    try {
      return await solveWithDeepSeek(request, { deadlineMs: deadline.remaining() });
    } catch (error) {
      const reason = scrubErrorText(error instanceof Error ? error.message : String(error)).slice(0, 160);
      failures.push(`deepseek: ${reason}`);
      console.warn("[mathmentor] DeepSeek solve failed:", reason);
    }
  }
  if (openaiSolverKey() && canStartCall(deadline.remaining())) {
    try {
      return await solveWithOpenAI(request, { deadlineMs: deadline.remaining() });
    } catch (error) {
      const reason = scrubErrorText(error instanceof Error ? error.message : String(error)).slice(0, 160);
      failures.push(`openai: ${reason}`);
      console.warn("[mathmentor] OpenAI solve failed:", reason);
    }
  }
  if (failures.length > 0) {
    await recordOpsError({
      source: "solver.rescue",
      message: `solver rescue unavailable: ${failures.join(" | ")}`,
    }).catch(() => undefined);
  }
  return null;
}
