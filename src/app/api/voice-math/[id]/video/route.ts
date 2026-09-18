import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { attachTeacherAudio } from "@/lib/voiceMath";
import { getVoiceJob, patchVoiceJob } from "@/lib/voiceMath/store";
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
import { INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role)) {
    return NextResponse.json(
      {
        error: "Teacher/admin only: generate video from a voice explanation.",
        errorAr: "توليد الفيديو بصوت الأستاذ للأستاذ والإدارة فقط.",
      },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const job = await getVoiceJob(id);
  if (!job) return NextResponse.json({ error: "Voice job not found." }, { status: 404 });

  let body: { language?: string; speed?: number; useHeyGen?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const language = (body.language || job.language || "ar") as HeyGenLanguage;
  const speed = clampHeyGenSpeed(body.speed);
  const script =
    language === "fr" ? job.avatarScript.fr : language === "ar" ? job.avatarScript.ar : job.avatarScript.en;
  const audioUrl = job.hasAudio ? `/api/voice-math/${job.id}/audio` : undefined;
  const demo = !hasHeyGenKey();
  const title = `MathMentor · ${INSTRUCTOR_EN} · ${job.title}`;

  let heygen = newQueuedJob({
    lessonId: `voice-${job.id}`,
    title,
    script,
    notes:
      "Teacher voice recording can be used as narration when HeyGen is configured with a custom audio clone. Demo attaches the recorded (or silent timeline) audio to the canvas player.",
    mathExamples: job.finalAnswerLatex,
    language: language === "ar" ? "ar" : language,
    speed,
    timelineJson: JSON.stringify(job.timeline),
    demo,
  });
  heygen = await upsertHeyGenJob(heygen);

  const requestShape = buildHeyGenGeneratePayload({
    script,
    language: language === "ar" ? "ar" : language,
    title,
    speed,
    callbackId: heygen.id,
    callbackUrl: heygenCallbackUrl(),
  });

  if (demo) {
    const timeline = attachTeacherAudio(job.timeline, audioUrl || job.timeline.media?.audioUrl, {
      videoUrl: audioUrl ? null : DEMO_AVATAR_VIDEO,
      heygenJobId: heygen.id,
    });
    const updated = await patchVoiceJob(job.id, {
      timeline,
      heygenJobId: heygen.id,
      videoStatus: "demo",
      videoUrl: DEMO_AVATAR_VIDEO,
      studentEnabled: true,
    });
    return NextResponse.json({
      ok: true,
      demoMode: true,
      notice:
        "HEYGEN_API_KEY is empty — demo video uses the recorded teacher audio (or equal-time canvas chunks) plus the local avatar placeholder. Configure HeyGen to synthesize an avatar; the recording remains available as narration.",
      job: updated,
      heygenJob: heygen,
      heygenRequest: requestShape,
      playerPath: `/lessons/voice-solver?id=${encodeURIComponent(job.id)}`,
      studioPath: `/studio/voice-solver?id=${encodeURIComponent(job.id)}`,
    });
  }

  try {
    const generated = await createAvatarTalkingVideo({
      script,
      language: language === "ar" ? "ar" : language,
      title,
      speed,
      callbackId: heygen.id,
      callbackUrl: heygenCallbackUrl(),
    });
    heygen = (await upsertHeyGenJob({
      ...heygen,
      status: generated.status === "failed" ? "failed" : "processing",
      heygenVideoId: generated.videoId,
      videoUrl: generated.videoUrl,
      thumbnailUrl: generated.thumbnailUrl,
      message: `${generated.message} Teacher voice recording can be used as narration when a custom HeyGen voice is configured.`,
      demo: false,
    }))!;
    const timeline = attachTeacherAudio(job.timeline, audioUrl || job.timeline.media?.audioUrl || "", {
      videoUrl: generated.videoUrl,
      heygenJobId: heygen.id,
    });
    const updated = await patchVoiceJob(job.id, {
      timeline,
      heygenJobId: heygen.id,
      videoStatus: heygen.status === "failed" ? "failed" : "processing",
      videoUrl: generated.videoUrl,
      studentEnabled: true,
    });
    return NextResponse.json({
      ok: true,
      demoMode: false,
      notice:
        "HeyGen avatar generation started. The teacher recording stays attached as optional narration (media.audioUrl) when configured.",
      job: updated,
      heygenJob: heygen,
      heygenRequest: requestShape,
      playerPath: `/lessons/voice-solver?id=${encodeURIComponent(job.id)}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HeyGen generate failed.";
    heygen = (await upsertHeyGenJob({ ...heygen, status: "failed", error: message, message, demo: false }))!;
    await patchVoiceJob(job.id, { videoStatus: "failed", heygenJobId: heygen.id });
    return NextResponse.json({ ok: false, error: message, heygenJob: heygen }, { status: 502 });
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const job = await getVoiceJob(id);
  if (!job) return NextResponse.json({ error: "Voice job not found." }, { status: 404 });
  const heygen = job.heygenJobId ? await getHeyGenJob(job.heygenJobId) : undefined;
  return NextResponse.json({ job, heygenJob: heygen });
}
