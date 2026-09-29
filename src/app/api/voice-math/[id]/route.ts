import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getVoiceJob } from "@/lib/voiceMath";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const { id } = await context.params;
  const job = await getVoiceJob(id);
  if (!job) return NextResponse.json({ error: "Voice job not found." }, { status: 404 });
  const staff = isStaffRole(guard.live.user.role);
  if (!staff && job.userId !== guard.live.user.id && !job.studentEnabled) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  return NextResponse.json({
    ok: true,
    job,
    playerPath: `/lessons/voice-solver?id=${encodeURIComponent(job.id)}`,
    studioPath: `/studio/voice-solver?id=${encodeURIComponent(job.id)}`,
    audioPath: job.hasAudio ? `/api/voice-math/${job.id}/audio` : undefined,
  });
}
