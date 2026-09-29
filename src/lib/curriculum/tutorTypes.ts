/**
 * Client-safe pedagogical tutor types (no LLM / process.env).
 * Branding: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

import type { CurriculumId, CurriculumLanguage } from "./types";

export type TutorMode = "direct" | "socratic";

export type TutorStep = {
  title: string;
  justification: string;
  latex?: string;
};

export type TutorHint = {
  level: number;
  text: string;
  latex?: string;
};

export type PedagogicalTutorResult = {
  ok: true;
  mode: TutorMode;
  curriculumId: CurriculumId;
  language: CurriculumLanguage;
  curriculumObjective: string;
  prerequisiteConcept: string;
  steps: TutorStep[];
  finalAnswer: string;
  finalAnswerLatex: string;
  hints: TutorHint[];
  revealAnswer: boolean;
  source: "gemini" | "openai" | "demo";
  warning?: string;
  warningAr?: string;
  voiceHook?: string;
  imageStatus?: "used" | "stub" | "none";
};

export type PedagogicalTutorRequest = {
  text?: string;
  latex?: string;
  imageBase64?: string;
  mimeType?: string;
  mode: TutorMode;
  curriculumId: CurriculumId;
  language: CurriculumLanguage;
  /** When true in socratic mode, include the boxed final answer. */
  revealAnswer?: boolean;
};
