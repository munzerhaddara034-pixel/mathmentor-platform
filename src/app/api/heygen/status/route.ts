import { NextResponse } from "next/server";
import { fetchAvatarTalkingVideo, hasHeyGenKey } from "@/lib/studio/heygen";
import { getHeyGenJob, listHeyGenJobs, patchHeyGenJob, playerPathForJob, resolveJobTimeline } from "@/lib/studio/heygenJobs";
import { notifyVideoJobIfReady } from "@/lib/whatsapp/notify";
import { apiRequireStaff, apiSession } from "@/lib/auth/guards";
import { publicHeyGenJob } from "@/lib/security/publicViews";

export const runtime = "nodejs";

async function refreshLiveJob(jobId: string) {
  let job = await getHeyGenJob(jobId);
  if (!job) return undefined;
  if (!job.demo && hasHeyGenKey() && job.heygenVideoId && job.status !== "completed" && job.status !== "failed") {
    const live = await fetchAvatarTalkingVideo(job.heygenVideoId);
    if (live.status === "completed" || live.status === "failed" || live.videoUrl) {
      job =
        (await patchHeyGenJob(job.id, {
          status: live.status === "completed" ? "completed" : live.status === "failed" ? "failed" : "processing",
          videoUrl: live.videoUrl ?? job.videoUrl,
          thumbnailUrl: live.thumbnailUrl ?? job.thumbnailUrl,
          message: live.message,
          error: live.status === "failed" ? live.message : undefined,
          studentEnabled: live.status === "completed" ? true : job.studentEnabled,
        })) ?? job;
    }
  }
  return job;
}

async function statusPayload(jobId: string) {
  const job = await refreshLiveJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Unknown jobId." }, { status: 404 });
  }
  if (job.status === "completed") {
    await notifyVideoJobIfReady(job.id);
  }
  return NextResponse.json({
    job,
    timeline: resolveJobTimeline(job),
    playerPath: playerPathForJob(job),
    demoMode: job.demo,
  });
}

/**
 * Signed-in non-staff (the student player): read-only, published jobs only, public job shape
 * (no script / notes / provider ids / errors), no HeyGen refresh and no WhatsApp notify side effects.
 */
async function publicStatusPayload(jobId: string) {
  const job = await getHeyGenJob(jobId);
  if (!job || !job.studentEnabled) {
    return NextResponse.json({ error: "Unknown jobId." }, { status: 404 });
  }
  return NextResponse.json({
    job: publicHeyGenJob(job),
    timeline: resolveJobTimeline(job),
    playerPath: playerPathForJob(job),
    demoMode: job.demo,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId") || url.searchParams.get("video_id") || "";
  const staff = await apiRequireStaff();
  if (staff.error) {
    // Listing every job (scripts, notes, provider ids) is staff-only.
    if (!jobId) return staff.error;
    const session = await apiSession();
    if (session.error) return session.error;
    return publicStatusPayload(jobId);
  }
  if (!jobId) {
    const jobs = await listHeyGenJobs();
    return NextResponse.json({
      jobs,
      demoMode: !hasHeyGenKey(),
    });
  }
  return statusPayload(jobId);
}

export async function POST(request: Request) {
  // POST refreshes from HeyGen, patches the job and may notify on WhatsApp: staff only.
  const staff = await apiRequireStaff();
  if (staff.error) return staff.error;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const record = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const url = new URL(request.url);
  const jobId = String(record.jobId ?? record.video_id ?? url.searchParams.get("jobId") ?? "");
  if (!jobId) {
    return NextResponse.json({ error: "Expected jobId." }, { status: 400 });
  }
  return statusPayload(jobId);
}
