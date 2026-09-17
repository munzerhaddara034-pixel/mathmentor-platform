export type ExamTrack = "brevet" | "terminale-gs" | "terminale-ls" | "terminale-se";

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
