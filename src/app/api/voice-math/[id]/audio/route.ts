import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getVoiceAudio, getVoiceJob } from "@/lib/voiceMath";

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
  const audio = await getVoiceAudio(id);
  if (!audio) return NextResponse.json({ error: "No audio stored for this job." }, { status: 404 });
  const bytes = Buffer.from(audio.base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": audio.mimeType || "audio/webm",
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `inline; filename="${audio.filename || `voice-${id}.webm`}"`,
    },
  });
}
