import { NextResponse } from "next/server";
import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { transcribeAudioOrDemo } from "@/lib/voiceMath/whisper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/** Voice note → text (Whisper, then Gemini audio fallback). Never invents a practice dictation. */
export async function POST(request: Request) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return teamError(400, "Expected multipart/form-data.", "صيغة الطلب غير صالحة.");
  }
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return teamError(400, "Audio required.", "لم يصل أي تسجيل صوتي.");
  if (audio.size > MAX_AUDIO_BYTES) return teamError(413, "Audio too large.", "التسجيل أطول من المسموح.");
  try {
    const transcript = await transcribeAudioOrDemo({
      bytes: Buffer.from(await audio.arrayBuffer()),
      filename: audio.name || "team-voice.webm",
      mimeType: audio.type || "audio/webm",
      language: "ar",
      allowPracticeDictation: false,
    });
    if (!transcript.text.trim()) {
      return teamError(422, "Transcription failed.", transcript.warningAr || "تعذّر تفريغ التسجيل. جرّب مرة أخرى أو اكتب الرسالة.");
    }
    return NextResponse.json({ ok: true, text: transcript.text, source: transcript.source, warning: transcript.warning });
  } catch (error) {
    console.error("team/transcribe", error);
    return teamError(500, "Transcription failed.", "تعذّر تفريغ التسجيل الصوتي.");
  }
}
