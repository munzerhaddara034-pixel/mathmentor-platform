export type {
  CurriculumFamily,
  CurriculumId,
  CurriculumLanguage,
  CurriculumDefinition,
  CurriculumTerminology,
  CurriculumSampleTopic,
  GradeBand,
  TrackFilter,
  ExamArchiveFilter,
} from "./types";

export {
  CURRICULUM_STORAGE_KEY,
  CURRICULUM_COOKIE_KEY,
  DEFAULT_CURRICULUM_ID,
  SWITCHER_CURRICULUM_IDS,
} from "./types";

export {
  CURRICULUM_CATALOG,
  CURRICULUM_LIST,
  getCurriculum,
  isCurriculumId,
  primaryExamTrackFor,
  primarySolverTrackFor,
} from "./catalogs";

export { terminologyFor } from "./terminology";

export {
  parseCurriculumId,
  readStoredCurriculumId,
  persistCurriculumId,
  curriculumIdFromCookieHeader,
} from "./persistence";

export { lebaneseCatalog, trackLabel } from "./lebaneseCatalog";

/** Client-safe tutor types only — never re-export runPedagogicalTutor here. */
export type {
  TutorMode,
  TutorStep,
  TutorHint,
  PedagogicalTutorResult,
  PedagogicalTutorRequest,
} from "./tutorTypes";
