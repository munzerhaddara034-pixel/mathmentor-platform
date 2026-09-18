import type { AvatarScript, CanvasTimelineJson, MathSolution, SolverStep } from "@/lib/solver/types";
import type { CertificateTrack, LessonLanguage, LessonTimeline } from "@/lib/studio/timeline";

export type VoiceMathSource = "whisper" | "demo" | "typed";
export type VoiceParseSource = "gemini" | "openai" | "demo";
export type VoiceVideoStatus = "none" | "queued" | "processing" | "completed" | "failed" | "demo";

export type WhisperSegment = {
  start: number;
  end: number;
  text: string;
};

export type LatexStep = {
  title: string;
  titleFr?: string;
  titleAr?: string;
  latex: string;
  examVerbEn?: string;
  examVerbFr?: string;
  theoremEn?: string;
  theoremFr?: string;
  theoremAr?: string;
  explanationEn: string;
  explanationFr: string;
  explanationAr?: string;
  boxed?: boolean;
  at?: number;
};

export type VoiceTranscript = {
  text: string;
  /** Official LaTeX after the formatting cleaning layer (spoken → Word-equation). */
  formattedLatex?: string;
  language?: string;
  durationSec?: number;
  segments: WhisperSegment[];
  source: VoiceMathSource;
  warning?: string;
};

export type VoiceMathResult = {
  transcript: VoiceTranscript;
  question: string;
  latexDraft: string;
  latexSteps: LatexStep[];
  canvasTimeline: CanvasTimelineJson;
  avatarScript: AvatarScript;
  timeline: LessonTimeline;
  solution: MathSolution;
  parseSource: VoiceParseSource;
  warning?: string;
};

export type VoiceMathJob = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  transcript: VoiceTranscript;
  question: string;
  latexDraft: string;
  latexSteps: LatexStep[];
  canvasTimeline: CanvasTimelineJson;
  avatarScript: AvatarScript;
  timeline: LessonTimeline;
  steps: SolverStep[];
  finalAnswer: string;
  finalAnswerLatex: string;
  parseSource: VoiceParseSource;
  warning?: string;
  hasAudio: boolean;
  audioMimeType?: string;
  studentEnabled: boolean;
  videoStatus: VoiceVideoStatus;
  heygenJobId?: string;
  videoUrl?: string;
  language: LessonLanguage;
  track: CertificateTrack;
  createdAt: string;
  updatedAt: string;
};

export type StoredAudio = {
  mimeType: string;
  base64: string;
  filename?: string;
};
