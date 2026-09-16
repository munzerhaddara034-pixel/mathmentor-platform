import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHeyGenStaff } from "@/lib/studio/heygenAuth";
import {
  buildHeyGenGeneratePayload,
  clampHeyGenSpeed,
  createAvatarTalkingVideo,
  hasHeyGenKey,
  heygenCallbackUrl,
  type HeyGenLanguage,
} from "@/lib/studio/heygen";
import { getHeyGenJob, newQueuedJob, upsertHeyGenJob } from "@/lib/studio/heygenJobs";
import { lessonLanguageSchema } from "@/lib/studio/timeline";

export const runtime = "nodejs";

const bodySchema = z.object({
  script: z.string().min(1),
  notes: z.string().optional(),
  mathExamples: z.string().optional(),
  language: lessonLanguageSchema.default("en"),
  speed: z.number().optional(),
  lessonId: z.string().min(1).default("leb-term-func-01"),
  title: z.string().optional(),
  timelineJson: z.string().optional(),
  voiceId: z.string().optional(),
});

export async function POST(request: Request) {
  const guard = await requireHeyGenStaff(request, { write: true });
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Expected { script, language?, lessonId?, speed?, notes?, mathExamples?, timelineJson? }.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const language = data.language as HeyGenLanguage;
  const speed = clampHeyGenSpeed(data.speed);
  const demo = !hasHeyGenKey();
  const title = data.title?.trim() || `MathMentor · ${data.lessonId}`;

  let job = newQueuedJob({
    lessonId: data.lessonId,
    title,
    script: data.script,
    notes: data.notes ?? "",
    mathExamples: data.mathExamples ?? "",
    language,
    speed,
    timelineJson: data.timelineJson,
    demo,
  });

  const existing = await getHeyGenJob(job.id);
  if (existing && demo) {
    job = await upsertHeyGenJob({
      ...existing,
      script: data.script,
      notes: data.notes ?? existing.notes,
      mathExamples: data.mathExamples ?? existing.mathExamples,
      language,
      speed,
      title,
      timelineJson: data.timelineJson ?? existing.timelineJson,
      lessonId: data.lessonId,
    });
  } else {
    job = await upsertHeyGenJob(job);
  }

  const requestShape = buildHeyGenGeneratePayload({
    script: data.script,
    language,
    title,
    speed,
    voiceId: data.voiceId,
    callbackId: job.id,
    callbackUrl: heygenCallbackUrl(),
  });

  if (demo) {
    return NextResponse.json({
      job,
      demoMode: true,
      notice: `${guard.notice} HEYGEN_API_KEY is empty — no network call to HeyGen. Poll GET /api/heygen/status?jobId=${job.id}`,
      heygenRequest: requestShape,
      playerPath: `/studio/player?job=${encodeURIComponent(job.id)}`,
    });
  }

  try {
    const heygen = await createAvatarTalkingVideo({
      script: data.script,
      language,
      title,
      speed,
      voiceId: data.voiceId,
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
    return NextResponse.json({
      job,
      demoMode: false,
      notice: guard.notice,
      heygenRequest: requestShape,
      playerPath: `/studio/player?job=${encodeURIComponent(job.id)}`,
    });
  } catch (error) {
    job = (await upsertHeyGenJob({
      ...job,
      status: "failed",
      error: error instanceof Error ? error.message : "HeyGen generate failed.",
      message: error instanceof Error ? error.message : "HeyGen generate failed.",
      demo: false,
    }))!;
    return NextResponse.json({ job, error: job.error, demoMode: false }, { status: 502 });
  }
}
