import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listVoiceJobs, recordVoiceJob, runVoiceMath } from "@/lib/voiceMath";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";

export const runtime = "nodejs";

function asLanguage(value: FormDataEntryValue | string | null): LessonLanguage | undefined {
  const text = typeof value === "string" ? value : "";
  if (text === "fr" || text === "en" || text === "ar") return text;
  return undefined;
}

function asTrack(value: FormDataEntryValue | string | null): CertificateTrack | undefined {
  const text = typeof value === "string" ? value : "";
  const allowed: CertificateTrack[] = ["brevet", "ls", "se", "gs", "lh", "eb7", "eb8", "s1", "sat"];
  return allowed.includes(text as CertificateTrack) ? (text as CertificateTrack) : undefined;
}

function truthy(value: FormDataEntryValue | string | boolean | null | undefined) {
  if (value === true) return true;
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return text === "1" || text === "true" || text === "demo";
}

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const staff = isStaffRole(guard.live.user.role);
  const jobs = await listVoiceJobs(staff ? { limit: 80 } : { userId: guard.live.user.id, limit: 30 });
  return NextResponse.json({
    jobs: jobs.map((job) => ({
      id: job.id,
      title: job.title,
      question: job.question,
      createdAt: job.createdAt,
      parseSource: job.parseSource,
      videoStatus: job.videoStatus,
      hasAudio: job.hasAudio,
      studentEnabled: job.studentEnabled,
      warning: job.warning,
      playerPath: `/lessons/voice-solver?id=${encodeURIComponent(job.id)}`,
      studioPath: `/studio/voice-solver?id=${encodeURIComponent(job.id)}`,
    })),
  });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role)) {
    return NextResponse.json(
      {
        error: "Teacher/admin only: record and generate voice explanations.",
        errorAr: "تسجيل الشرح الصوتي وتوليد الفيديو للأستاذ والإدارة فقط.",
      },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let transcript = "";
  let language: LessonLanguage | undefined;
  let track: CertificateTrack | undefined;
  let durationSec: number | undefined;
  let demo = false;
  let bytes: Buffer | undefined;
  let filename: string | undefined;
  let mimeType: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    transcript = String(form.get("transcript") ?? "").trim();
    language = asLanguage(form.get("language"));
    track = asTrack(form.get("track"));
    demo = truthy(form.get("demo"));
    const durationRaw = String(form.get("durationSec") ?? "").trim();
    if (durationRaw) {
      const n = Number(durationRaw);
      if (Number.isFinite(n) && n > 0) durationSec = n;
    }
    const file = form.get("audio") ?? form.get("file");
    if (file instanceof File && file.size > 0) {
      bytes = Buffer.from(await file.arrayBuffer());
      filename = file.name;
      mimeType = file.type || "audio/webm";
    }
  } else {
    let json: {
      transcript?: string;
      language?: string;
      track?: string;
      demo?: boolean | string;
      durationSec?: number;
    };
    try {
      json = (await request.json()) as typeof json;
    } catch {
      return NextResponse.json({ error: "Invalid JSON or form body." }, { status: 400 });
    }
    transcript = json.transcript?.trim() ?? "";
    language = asLanguage(json.language ?? null);
    track = asTrack(json.track ?? null);
    demo = truthy(json.demo);
    if (typeof json.durationSec === "number" && json.durationSec > 0) durationSec = json.durationSec;
  }

  if (!bytes && !transcript && !demo) {
    demo = true;
  }

  const result = await runVoiceMath({
    bytes,
    filename,
    mimeType,
    transcript: transcript || undefined,
    language,
    track,
    durationSec,
    demo,
  });
  const job = await recordVoiceJob(
    user,
    { bytes, filename, mimeType, transcript, language, track, durationSec, demo },
    result,
  );

  return NextResponse.json({
    ok: true,
    id: job.id,
    job,
    transcript: job.transcript,
    latexSteps: job.latexSteps,
    canvasTimeline: job.canvasTimeline,
    avatarScript: job.avatarScript,
    timeline: job.timeline,
    parseSource: job.parseSource,
    warning: job.warning,
    playerPath: `/lessons/voice-solver?id=${encodeURIComponent(job.id)}`,
    studioPath: `/studio/voice-solver?id=${encodeURIComponent(job.id)}`,
  });
}
