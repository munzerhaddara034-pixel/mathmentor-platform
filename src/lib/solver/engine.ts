import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createId } from "@/lib/ids";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import { hasHeyGenKey } from "@/lib/studio/heygen";
import { newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { attachDemoMedia } from "./assemble";
import { demoSolve, type SolveRequest } from "./demoSolver";
import { demoFallback, hasGeminiKey, openaiSolverKey, solveWithGemini, solveWithOpenAI } from "./llm";
import { looksLikeMath, retakeSolution } from "./retake";
import { saveMathQuery } from "./store";
import type { MathQueryRecord, MathSolution } from "./types";
import type { PublicUser } from "@/lib/auth/store";

export type EngineInput = SolveRequest & {
  imageBase64?: string;
  mimeType?: string;
  imageUrl?: string;
};

export async function persistUploadedImage(file: File) {
  const dir = path.join(process.cwd(), "public", "uploads", "math");
  await mkdir(dir, { recursive: true });
  const safe = `${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safe), bytes);
  return {
    imageUrl: `/uploads/math/${safe}`,
    imageName: file.name,
    mimeType: file.type || "image/jpeg",
    imageBase64: bytes.toString("base64"),
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

  if (hasGeminiKey() && (typed || input.imageBase64)) {
    try {
      return await solveWithGemini({ ...request, imageBase64: input.imageBase64, mimeType: input.mimeType });
    } catch (error) {
      if (input.imageBase64 && !typedIsMath) {
        return retakeSolution({
          question: typed,
          language: request.language,
          imageName: request.imageName,
          source: "demo",
        });
      }
      return demoFallback(request, error instanceof Error ? error.message : "Gemini failed; used demo solver.");
    }
  }

  if (openaiSolverKey() && typedIsMath && !input.imageBase64) {
    try {
      return await solveWithOpenAI(request);
    } catch (error) {
      return demoFallback(request, error instanceof Error ? error.message : "OpenAI failed; used demo solver.");
    }
  }

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
  } else if (!hasGeminiKey() && !openaiSolverKey()) {
    solution.warning =
      solution.warning ||
      "No GEMINI_API_KEY / OPENAI_API_KEY — deterministic Lebanese curriculum demo solver.";
  }
  return solution;
}

export async function recordSolution(user: PublicUser, input: EngineInput, solution: MathSolution): Promise<MathQueryRecord> {
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

  return saveMathQuery({
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
    auditStatus: "pending",
    videoStatus,
    heygenJobId,
    videoUrl,
  });
}
