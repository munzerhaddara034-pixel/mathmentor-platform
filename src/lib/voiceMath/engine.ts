import { INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";
import { createId } from "@/lib/ids";
import type { PublicUser } from "@/lib/auth/store";
import type { CertificateTrack, LessonLanguage } from "@/lib/studio/timeline";
import { parseSpeechToMath } from "./parser";
import { attachTeacherAudio, syncTimelineToAudio } from "./sync";
import { getVoiceJob, saveVoiceAudio, saveVoiceJob } from "./store";
import { transcribeAudioOrDemo } from "./whisper";
import { formatLatexFields, spokenMathToLebaneseLatex } from "@/lib/math/lebaneseEquationFormat";
import type { StoredAudio, VoiceMathJob, VoiceMathResult } from "./types";

export type VoiceEngineInput = {
  bytes?: Buffer;
  filename?: string;
  mimeType?: string;
  transcript?: string;
  language?: LessonLanguage;
  track?: CertificateTrack;
  durationSec?: number;
  demo?: boolean;
};

export async function runVoiceMath(input: VoiceEngineInput): Promise<VoiceMathResult> {
  const transcript = await transcribeAudioOrDemo({
    bytes: input.bytes,
    filename: input.filename,
    mimeType: input.mimeType,
    language: input.language,
    transcript: input.transcript,
    durationSec: input.durationSec,
    demo: input.demo,
  });
  // Formatting cleaning layer — spoken Arabic/English → Word Insert Equation LaTeX
  // BEFORE the solver and Live Canvas render. Demo transcripts take the same path.
  const formattedLatex = spokenMathToLebaneseLatex(transcript.text);
  transcript.formattedLatex = formattedLatex;
  const parsed = await parseSpeechToMath({
    transcript: transcript.text,
    formattedTranscript: formattedLatex,
    language: input.language ?? (transcript.language === "fr" ? "fr" : transcript.language === "en" ? "en" : "ar"),
    track: input.track,
  });
  const durationSec = input.durationSec || transcript.durationSec || parsed.solution.timeline.durationSec;
  const synced = syncTimelineToAudio(formatLatexFields(parsed.solution.timeline), {
    durationSec,
    segments: transcript.segments,
  });
  const latexSteps = formatLatexFields(parsed.latexSteps);
  const canvasTimeline = formatLatexFields(synced.canvasTimeline);
  const timeline = formatLatexFields(synced.timeline);
  const warning = [transcript.warning, parsed.warning, parsed.solution.warning].filter(Boolean).join(" ");
  return {
    transcript,
    question: parsed.question,
    latexDraft: spokenMathToLebaneseLatex(parsed.latexDraft),
    latexSteps,
    canvasTimeline,
    avatarScript: parsed.solution.avatarScript,
    timeline,
    solution: formatLatexFields({
      ...parsed.solution,
      canvasTimeline,
      timeline,
      warning: warning || parsed.solution.warning,
    }),
    parseSource: parsed.parseSource,
    warning: warning || undefined,
  };
}

export async function recordVoiceJob(
  user: PublicUser,
  input: VoiceEngineInput,
  result: VoiceMathResult,
): Promise<VoiceMathJob> {
  const language: LessonLanguage =
    input.language ?? (result.transcript.language === "fr" ? "fr" : result.transcript.language === "en" ? "en" : "ar");
  const id = createId("voice");
  const hasAudio = Boolean(input.bytes && input.bytes.length > 0);
  if (hasAudio && input.bytes) {
    const audio: StoredAudio = {
      mimeType: input.mimeType || "audio/webm",
      base64: input.bytes.toString("base64"),
      filename: input.filename,
    };
    await saveVoiceAudio(id, audio);
  }
  const audioUrl = hasAudio ? `/api/voice-math/${id}/audio` : undefined;
  const timeline = audioUrl ? attachTeacherAudio(result.timeline, audioUrl) : result.timeline;
  return saveVoiceJob({
    id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    title: result.question.slice(0, 80) || `${INSTRUCTOR_EN} voice explanation`,
    transcript: result.transcript,
    question: result.question,
    latexDraft: result.latexDraft,
    latexSteps: result.latexSteps,
    canvasTimeline: result.canvasTimeline,
    avatarScript: result.avatarScript,
    timeline,
    steps: result.solution.steps,
    finalAnswer: result.solution.finalAnswer,
    finalAnswerLatex: result.solution.finalAnswerLatex,
    parseSource: result.parseSource,
    warning: result.warning,
    hasAudio,
    audioMimeType: input.mimeType,
    studentEnabled: true,
    videoStatus: "none",
    language,
    track: input.track ?? result.solution.track,
  });
}

export async function audioUrlForJob(id: string) {
  const job = await getVoiceJob(id);
  if (!job?.hasAudio) return undefined;
  return `/api/voice-math/${id}/audio`;
}
