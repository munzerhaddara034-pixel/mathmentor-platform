import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess } from "@/lib/auth/store";
import { getMathQuery, setQueryVideo } from "@/lib/solver";
import { attachDemoMedia } from "@/lib/solver/assemble";
import {
  buildHeyGenGeneratePayload,
  clampHeyGenSpeed,
  createAvatarTalkingVideo,
  hasHeyGenKey,
  heygenCallbackUrl,
  type HeyGenLanguage,
} from "@/lib/studio/heygen";
import { getHeyGenJob, newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { DEMO_AVATAR_VIDEO } from "@/lib/studio/heygenClient";
import { lessonLanguageSchema } from "@/lib/studio/timeline";

export const runtime = "nodejs";

const bodySchema = z.object({
  queryId: z.string().min(1).optional(),
  script: z.string().optional(),
  language: lessonLanguageSchema.optional(),
  title: z.string().optional(),
  timelineJson: z.string().optional(),
  speed: z.number().optional(),
});

export async function GET(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") ?? url.searchParams.get("queryId");
  if (!jobId) return NextResponse.json({ error: "jobId or queryId required." }, { status: 400 });
  const query = await getMathQuery(jobId);
  const job = query?.heygenJobId ? await getHeyGenJob(query.heygenJobId) : await getHeyGenJob(jobId);
  return NextResponse.json({
    query,
    job,
    playerPath: query ? `/lessons/interactive-explanation?id=${encodeURIComponent(query.id)}` : job ? `/studio/player?job=${encodeURIComponent(job.id)}` : undefined,
  });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role) && !(await userHasAiAccess(user))) {
    return NextResponse.json(
      { error: "AI_TIER or BOTH required to generate explanations.", errorAr: "يلزم اشتراك الذكاء لتوليد الشرح." },
      { status: 403 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { queryId } or { script, timelineJson }.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const query = data.queryId ? await getMathQuery(data.queryId) : undefined;
  if (data.queryId && !query) return NextResponse.json({ error: "Math query not found." }, { status: 404 });
  if (query && !isStaffRole(user.role) && query.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const script = data.script?.trim() || query?.avatarScript.en || "";
  if (!script) return NextResponse.json({ error: "script or queryId with avatarScript required." }, { status: 400 });

  const language = (data.language || query?.language || "en") as HeyGenLanguage;
  const speed = clampHeyGenSpeed(data.speed);
  const demo = !hasHeyGenKey();
  const title = data.title?.trim() || `MathMentor · ${query?.topic ?? query?.question ?? "explanation"}`;
  const timeline = query ? attachDemoMedia(query.timeline) : undefined;
  const timelineJson = data.timelineJson || (timeline ? JSON.stringify(timeline) : undefined);

  let job = newQueuedJob({
    lessonId: query ? `math-${query.id}` : "math-explanation",
    title,
    script,
    notes: query?.summary ?? "",
    mathExamples: query?.finalAnswerLatex ?? "",
    language,
    speed,
    timelineJson,
    demo,
  });
  job = await upsertHeyGenJob(job);

  const requestShape = buildHeyGenGeneratePayload({
    script,
    language,
    title,
    speed,
    callbackId: job.id,
    callbackUrl: heygenCallbackUrl(),
  });

  if (query) {
    await setQueryVideo(query.id, {
      videoStatus: demo ? "demo" : "queued",
      heygenJobId: job.id,
      videoUrl: demo ? DEMO_AVATAR_VIDEO : undefined,
    });
  }

  if (demo) {
    return NextResponse.json({
      ok: true,
      job,
      demoMode: true,
      notice: "HEYGEN_API_KEY is empty — mock job. Poll GET /api/heygen/status?jobId=… or open the player with the demo clip.",
      heygenRequest: requestShape,
      playerPath: query
        ? `/lessons/interactive-explanation?id=${encodeURIComponent(query.id)}`
        : `/studio/player?job=${encodeURIComponent(job.id)}`,
      queryId: query?.id,
    });
  }

  try {
    const heygen = await createAvatarTalkingVideo({
      script,
      language,
      title,
      speed,
      callbackId: job.id,
      callbackUrl: heygenCallbackUrl(),
    });
    job = (await upsertHeyGenJob({
      ...job,
      status: heygen.status === "failed" ? "failed" : "processing",
      heygenVideoId: heygen.videoId,
      videoUrl: heygen.videoUrl,
      thumbnailUrl: heygen.thumbnailUrl,
      message: heygen.message,
      demo: false,
    }))!;
    if (query) {
      await setQueryVideo(query.id, {
        videoStatus: job.status === "failed" ? "failed" : "processing",
        heygenJobId: job.id,
        videoUrl: job.videoUrl,
      });
    }
    return NextResponse.json({
      ok: true,
      job,
      demoMode: false,
      heygenRequest: requestShape,
      playerPath: query
        ? `/lessons/interactive-explanation?id=${encodeURIComponent(query.id)}`
        : `/studio/player?job=${encodeURIComponent(job.id)}`,
      queryId: query?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HeyGen generate failed.";
    job = (await upsertHeyGenJob({ ...job, status: "failed", error: message, message, demo: false }))!;
    if (query) await setQueryVideo(query.id, { videoStatus: "failed", heygenJobId: job.id });
    return NextResponse.json({ ok: false, job, error: message }, { status: 502 });
  }
}
