import type { CertificateTrack, LessonLanguage, LessonTimeline } from "@/lib/studio/timeline";

export type SolverSource = "gemini" | "openai" | "demo";

export type SolverStep = {
  title: string;
  titleFr?: string;
  titleAr?: string;
  latex: string;
  explanationEn: string;
  explanationFr: string;
  explanationAr?: string;
};

export type CanvasTimelineEvent = {
  at: number;
  type: string;
  latex?: string;
  expression?: string;
  domain?: [number, number];
  highlights?: unknown;
  caption?: { en: string; fr?: string; ar?: string };
  math_latex?: string;
  step_en?: string;
  step_fr?: string;
};

export type CanvasTimelineJson = {
  durationSec: number;
  events: CanvasTimelineEvent[];
  chapters?: Array<{ id: string; at: number; label: { en: string; fr?: string; ar?: string } }>;
};

export type AvatarScript = {
  en: string;
  fr: string;
  ar: string;
};

export type MathSolution = {
  summary: string;
  finalAnswer: string;
  finalAnswerLatex: string;
  steps: SolverStep[];
  avatarScript: AvatarScript;
  canvasTimeline: CanvasTimelineJson;
  timeline: LessonTimeline;
  topic: string;
  track: CertificateTrack;
  language: LessonLanguage;
  source: SolverSource;
  warning?: string;
  recognizedFromImage?: string;
};

export type VideoJobStatus = "none" | "queued" | "processing" | "completed" | "failed" | "demo";

export type MathQueryRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  question: string;
  latex?: string;
  imageUrl?: string;
  imageName?: string;
  language: LessonLanguage;
  track: CertificateTrack;
  topic?: string;
  summary: string;
  finalAnswer: string;
  finalAnswerLatex: string;
  steps: SolverStep[];
  avatarScript: AvatarScript;
  canvasTimeline: CanvasTimelineJson;
  timeline: LessonTimeline;
  source: SolverSource;
  warning?: string;
  videoStatus: VideoJobStatus;
  heygenJobId?: string;
  videoUrl?: string;
  createdAt: string;
  updatedAt: string;
};
