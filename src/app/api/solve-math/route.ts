import { NextResponse } from "next/server";
import { apiRequireAiAccess, apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listMathQueries, persistUploadedImage, recordSolution, runMathSolver } from "@/lib/solver";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";

export const runtime = "nodejs";

function asLanguage(value: FormDataEntryValue | string | null): LessonLanguage | undefined {
  const text = typeof value === "string" ? value : "";
  if (text === "fr" || text === "en" || text === "ar") return text;
  return undefined;
}

function asTrack(value: FormDataEntryValue | string | null): CertificateTrack | undefined {
  const text = typeof value === "string" ? value : "";
  const allowed: CertificateTrack[] = ["brevet", "ls", "se", "gs", "lh", "eb7", "eb8", "s1", "sat", "university"];
  return allowed.includes(text as CertificateTrack) ? (text as CertificateTrack) : undefined;
}

function asText(value: FormDataEntryValue | string | null | undefined, max = 40): string | undefined {
  const text = typeof value === "string" ? value.trim().slice(0, max) : "";
  return text || undefined;
}

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const staff = isStaffRole(guard.live.user.role);
  const queries = await listMathQueries(staff ? { limit: 200 } : { userId: guard.live.user.id, limit: 50 });
  return NextResponse.json({ queries });
}

export async function POST(request: Request) {
  const guard = await apiRequireAiAccess();
  if (guard.error) return guard.error;
  const user = guard.live.user;

  const contentType = request.headers.get("content-type") ?? "";
  let question = "";
  let latex = "";
  let language: LessonLanguage | undefined;
  let track: CertificateTrack | undefined;
  let imageUrl: string | undefined;
  let imageName: string | undefined;
  let imageBase64: string | undefined;
  let mimeType: string | undefined;
  let curriculum: string | undefined;
  let platformCurriculum: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    question = String(form.get("question") ?? "").trim();
    latex = String(form.get("latex") ?? "").trim();
    language = asLanguage(form.get("language"));
    track = asTrack(form.get("track"));
    curriculum = asText(form.get("curriculum"));
    platformCurriculum = asText(form.get("platformCurriculum"));
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      const saved = await persistUploadedImage(file);
      imageUrl = saved.imageUrl;
      imageName = saved.imageName;
      imageBase64 = saved.imageBase64;
      mimeType = saved.mimeType;
    }
  } else {
    let json: {
      question?: string;
      /** Owner's original contract (`{ problem }`), still accepted. Direct Gemini path: /api/solve-math/gemini */
      problem?: string;
      latex?: string;
      language?: string;
      track?: string;
      imageBase64?: string;
      mimeType?: string;
      imageName?: string;
      curriculum?: string;
      platformCurriculum?: string;
    };
    try {
      json = (await request.json()) as typeof json;
    } catch {
      return NextResponse.json({ error: "Invalid JSON or form body." }, { status: 400 });
    }
    question = (json.question ?? json.problem)?.trim() ?? "";
    latex = json.latex?.trim() ?? "";
    language = asLanguage(json.language ?? null);
    track = asTrack(json.track ?? null);
    imageBase64 = json.imageBase64;
    mimeType = json.mimeType;
    imageName = json.imageName;
    curriculum = asText(json.curriculum);
    platformCurriculum = asText(json.platformCurriculum);
  }

  if (!question && !latex && !imageBase64) {
    return NextResponse.json(
      { error: "Write a question, LaTeX, or attach an image.", errorAr: "اكتب سؤالاً أو لاحقة أو أرفق صورة." },
      { status: 400 },
    );
  }

  const solution = await runMathSolver({
    question,
    latex,
    language,
    track,
    imageBase64,
    mimeType,
    imageName,
    imageUrl,
    curriculum,
    platformCurriculum,
  });
  const record = await recordSolution(
    user,
    { question, latex, language, track, imageBase64, mimeType, imageName, imageUrl },
    solution,
  );

  if (!record.needsRetake) {
    const { recordActivity } = await import("@/lib/gamification/store");
    await recordActivity({
      userId: user.id,
      name: user.name,
      kind: "solver",
      topic: record.topicTag?.includes("prob") ? "probability" : "calculus",
    });
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    query: record,
    summary: record.summary,
    finalAnswer: record.finalAnswer,
    finalAnswerLatex: record.finalAnswerLatex,
    steps: record.steps,
    avatarScript: record.avatarScript,
    canvasTimeline: record.canvasTimeline,
    timeline: record.timeline,
    source: record.source,
    warning: record.warning,
    videoStatus: record.videoStatus,
    needsRetake: record.needsRetake,
    retakeMessageEn: record.retakeMessageEn,
    retakeMessageAr: record.retakeMessageAr,
    given: record.given,
    topicTag: record.topicTag,
    curriculum: record.curriculum,
    needsReview: record.needsReview,
    playerPath: `/lessons/interactive-explanation?id=${encodeURIComponent(record.id)}`,
    resultPath: `/math-solver/result/${encodeURIComponent(record.id)}`,
  });
}
