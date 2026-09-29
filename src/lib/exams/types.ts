export type ExamTrack = "brevet" | "terminale-gs" | "terminale-ls" | "terminale-se" | "sat";

export type ExamResponseType = "open" | "mcq" | "spr";

export type ExamChoice = {
  id: string;
  text: string;
  latex?: string;
};

/** One official barème step (points the marker awards). */
export type BaremeStep = {
  id: string;
  labelEn: string;
  labelAr: string;
  marks: number;
};

export type ExamSubQuestion = {
  id: string;
  label: string;
  prompt: string;
  promptAr: string;
  latex?: string;
  marks: number;
  expected: string[];
  keywords?: string[];
  rubric: string;
  /** Official mark distribution — steps should sum to `marks`. */
  bareme?: BaremeStep[];
  /** Multiple-choice options (SAT-style A–D). */
  choices?: ExamChoice[];
  /** Default open (Lebanese free response). */
  responseType?: ExamResponseType;
  /** Skill tag for generate-similar (على نسقه). */
  skill?: string;
  /** Short official-style solution (EN). */
  solution?: string;
};

export type ExamQuestion = {
  id: string;
  number: number;
  title?: string;
  prompt?: string;
  promptAr?: string;
  subs: ExamSubQuestion[];
};

export type ExamPart = {
  id: string;
  roman: string;
  title: string;
  titleAr: string;
  questions: ExamQuestion[];
};

export type OfficialPaper = {
  id: string;
  track: ExamTrack;
  title: string;
  titleAr: string;
  sessionLabel: string;
  durationMinutes: number;
  totalMarks: number;
  parts: ExamPart[];
};

export type SubGrade = {
  subId: string;
  label: string;
  awarded: number;
  max: number;
  comment: string;
  commentAr: string;
};

export type GradeResult = {
  source: "demo" | "llm";
  totalAwarded: number;
  totalMax: number;
  percent: number;
  subs: SubGrade[];
  summary: string;
  summaryAr: string;
};

export type ExamAttempt = {
  id: string;
  paperId: string;
  userId: string;
  studentName: string;
  studentPhone: string;
  answers: Record<string, string>;
  grading: GradeResult;
  elapsedSec: number;
  createdAt: string;
};

/** One generated similar question (على نسقه). */
export type GeneratedSimilarQuestion = {
  id: string;
  sourcePaperId: string;
  sourceQuestionId: string;
  skill: string;
  prompt: string;
  latex?: string;
  responseType: ExamResponseType;
  choices?: ExamChoice[];
  correctAnswer: string;
  solution: string;
  marks: number;
  /** Pedagogy tag e.g. official-sat-style-5 — never CB verbatim text. */
  tag?: string;
};

export type GeneratedSimilarSet = {
  id: string;
  paperId: string;
  sourceQuestionId?: string;
  userId: string;
  source: "demo" | "llm";
  questions: GeneratedSimilarQuestion[];
  createdAt: string;
  /** e.g. official-sat-style-10 when generated from official blueprint. */
  tag?: string;
  officialTest?: 5 | 10 | 11;
};
