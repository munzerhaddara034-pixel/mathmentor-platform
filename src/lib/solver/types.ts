import type { CertificateTrack, LessonLanguage, LessonTimeline } from "@/lib/studio/timeline";
import type { SolverCurriculum, SolverLevel } from "./curriculum/types";
import type { CallRecord } from "./gemini/client";

export type SolverSource = "gemini" | "openai" | "demo";

/** Outcome of «محمد» + CAS verification as applied to the answer the student sees. */
export type SolverVerification = {
  status: "verified" | "needs_fix" | "unverified";
  noteAr: string;
  /** "sync" = ran before responding (university / Bac); "background" = admin log only (middle school). */
  mode: "sync" | "background";
  /** True when correctedFinalAnswer was applied to the student-visible box. */
  applied: boolean;
};

/** Diagnostics kept with each AI answer (model, latency, cost, CAS). */
export type SolverMeta = {
  curriculum: SolverCurriculum;
  level: SolverLevel;
  tier: "fast" | "strong";
  model?: string;
  calls: CallRecord[];
  solveMs?: number;
  totalMs?: number;
  costUsd?: number;
  /** Raw machine-checkable claims returned by the model. */
  checks?: unknown;
  cas?: { passed: number; failed: number; skipped: number; failures: string[] };
  repaired?: boolean;
  verification?: SolverVerification;
};

export type SolverStep = {
  title: string;
  titleFr?: string;
  titleAr?: string;
  examVerbEn?: string;
  examVerbFr?: string;
  latex: string;
  theoremEn?: string;
  theoremFr?: string;
  theoremAr?: string;
  explanationEn: string;
  explanationFr: string;
  explanationAr?: string;
  boxed?: boolean;
};

export type SolverGiven = {
  latex: string;
  aimEn: string;
  aimFr?: string;
  aimAr: string;
};

export type ExamTip = {
  en: string;
  fr: string;
  ar?: string;
};

export type StudyKind =
  | "real_function"
  | "geometry"
  | "complex"
  | "probability"
  | "algebra"
  | "limits"
  | "general";

export type AsymptoteSpec = {
  kind: "vertical" | "horizontal" | "oblique";
  equation: string;
};

export type AuditStatus = "pending" | "verified" | "needs_fix";
export type StudentRating = 1 | -1;

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
  examTip: ExamTip;
  studyKind: StudyKind;
  asymptotes?: AsymptoteSpec[];
  given: SolverGiven;
  steps: SolverStep[];
  avatarScript: AvatarScript;
  canvasTimeline: CanvasTimelineJson;
  timeline: LessonTimeline;
  topic: string;
  topicTag: string;
  track: CertificateTrack;
  language: LessonLanguage;
  source: SolverSource;
  warning?: string;
  recognizedFromImage?: string;
  needsRetake: boolean;
  retakeMessageEn?: string;
  retakeMessageAr?: string;
  curriculum?: SolverCurriculum;
  /** Shown to the student as «يحتاج مراجعة» when verification could not confirm the answer. */
  needsReview?: boolean;
  solverMeta?: SolverMeta;
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
  topicTag?: string;
  summary: string;
  examTip?: ExamTip;
  studyKind?: StudyKind;
  asymptotes?: AsymptoteSpec[];
  given?: SolverGiven;
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
  videoNotifiedAt?: string;
  needsRetake?: boolean;
  retakeMessageEn?: string;
  retakeMessageAr?: string;
  rating?: StudentRating;
  curriculum?: SolverCurriculum;
  needsReview?: boolean;
  solverMeta?: SolverMeta;
  auditStatus?: AuditStatus;
  auditNote?: string;
  createdAt: string;
  updatedAt: string;
};
