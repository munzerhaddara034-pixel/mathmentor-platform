/**
 * Global multi-curriculum foundations for MathMentor.
 * Branding: Prof. Munzer Haddara / الأستاذ منذر حداره — never Al-Tarah / الطارة.
 */

export type CurriculumFamily =
  | "lebanese"
  | "gcc"
  | "ib"
  | "cambridge"
  | "ap"
  | "sat_act";

/** Stable ids used in localStorage, cookies, APIs, and the switcher. */
export type CurriculumId =
  | "lebanese"
  | "saudi-gcc"
  | "ib"
  | "cambridge"
  | "ap"
  | "sat";

export type CurriculumLanguage = "ar" | "en";

export type GradeBand = {
  id: string;
  labelEn: string;
  labelAr: string;
  /** Optional official year / stage code. */
  code?: string;
};

export type TrackFilter = {
  id: string;
  labelEn: string;
  labelAr: string;
  /** Maps onto existing exam hub / solver CertificateTrack where possible. */
  examTrack?: string;
  solverTrack?: string;
};

export type ExamArchiveFilter = {
  id: string;
  labelEn: string;
  labelAr: string;
  years?: number[];
  sessions?: string[];
};

export type CurriculumSampleTopic = {
  id: string;
  titleEn: string;
  titleAr: string;
  objectiveEn: string;
  objectiveAr: string;
  prerequisiteEn: string;
  prerequisiteAr: string;
  samplePromptEn: string;
  samplePromptAr: string;
  sampleLatex?: string;
};

export type CurriculumDefinition = {
  id: CurriculumId;
  family: CurriculumFamily;
  labelEn: string;
  labelAr: string;
  shortEn: string;
  shortAr: string;
  descriptionEn: string;
  descriptionAr: string;
  grades: GradeBand[];
  tracks: TrackFilter[];
  examArchives: ExamArchiveFilter[];
  /** Content readiness for this release. */
  contentPhase: "default" | "sample" | "planned";
  samples: CurriculumSampleTopic[];
  defaultLanguage: CurriculumLanguage;
  defaultTrackId?: string;
};

export type CurriculumTerminology = {
  derivative: { en: string; ar: string };
  limits: { en: string; ar: string };
  domain: { en: string; ar: string };
  integral: { en: string; ar: string };
  asymptote: { en: string; ar: string };
  variationTable: { en: string; ar: string };
  finalAnswer: { en: string; ar: string };
  showThat: { en: string; ar: string };
};

export const CURRICULUM_STORAGE_KEY = "mathmentor.curriculumId";
export const CURRICULUM_COOKIE_KEY = "mm_curriculum";
export const DEFAULT_CURRICULUM_ID: CurriculumId = "lebanese";

export const SWITCHER_CURRICULUM_IDS: CurriculumId[] = [
  "lebanese",
  "saudi-gcc",
  "ib",
  "cambridge",
  "ap",
  "sat",
];
