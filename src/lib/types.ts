export type RoleView = "student" | "professor";
export type Language = "ar" | "en";
export type GradeTrack = "grade-7" | "grade-8" | "grade-9" | "grade-11" | "grade-12" | "sat";
export type SourceKind = "book" | "exam-model" | "worksheet" | "solution-guide";
export type DraftKind = "lesson-video" | "exam-solution-video" | "exam-solution-paper";
export type ReviewStatus =
  | "generating"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "changes_requested";

export type LibraryItem = {
  id: string;
  title: string;
  kind: SourceKind;
  track: GradeTrack;
  subject: string;
  language: Language;
  fileName: string;
  sourcePath?: string;
  notes: string;
  extractedText: string;
  createdAt: string;
};

export type StoryboardScene = {
  title: string;
  narration: string;
  board: string;
  durationSeconds: number;
  boardImage?: string;
};

export type ContentDraft = {
  id: string;
  libraryItemId: string;
  kind: DraftKind;
  title: string;
  skill: string;
  questionRef: string;
  language: Language;
  videoScript: string;
  storyboard: StoryboardScene[];
  printableSolution: string;
  videoUrl?: string;
  status: ReviewStatus;
  professorNote?: string;
  reviewedAt?: string;
  createdAt: string;
};

export type OutreachAudience = "school" | "student" | "parent";
export type OutreachStatus = "draft" | "awaiting_approval" | "approved" | "rejected" | "sent";

export type ManagerMessage = {
  id: string;
  from: "manager" | "professor";
  body: string;
  createdAt: string;
};

export type OutreachDraft = {
  id: string;
  audience: OutreachAudience;
  channel: "email" | "whatsapp" | "in_app";
  subject: string;
  body: string;
  status: OutreachStatus;
  professorNote?: string;
  createdAt: string;
  reviewedAt?: string;
};

export type StudentChatMessage = {
  id: string;
  from: "student" | "tutor";
  body: string;
  fileName?: string;
  fileUrl?: string;
  createdAt: string;
};

export type ProgressEntry = {
  lessonId: string;
  completedAt: string;
  score?: number;
  passedQuiz?: boolean;
};

export type QuizKind = "mcq" | "tf";
export type Difficulty = 1 | 2 | 3 | 4;

export type QuizQuestion = {
  id: string;
  lessonId: string;
  difficulty: Difficulty;
  kind?: QuizKind;
  prompt: string;
  latex?: string;
  imageUrl?: string;
  options: string[];
  correctIndex: number;
  steps: string[];
};

export type ExamPaper = {
  id: string;
  title: string;
  arabicTitle: string;
  track?: GradeTrack;
  lessonId?: string;
  questionIds: string[];
  durationMinutes: number;
  passScore: number;
  createdAt: string;
};

export type ScratchCard = {
  code: string;
  planId: string;
  used: boolean;
  usedBy?: string;
  usedPhone?: string;
  createdAt?: string;
  expiresAt?: string;
  batchId?: string;
  note?: string;
};

export type Entitlement = {
  id: string;
  studentName: string;
  phone?: string;
  planId: string;
  unlockedAt: string;
};

export type QuizAttempt = {
  id: string;
  lessonId: string;
  studentName: string;
  score: number;
  passed: boolean;
  points: number;
  createdAt: string;
};

export type ResourceFile = {
  id: string;
  title: string;
  arabicTitle: string;
  kind: "notes" | "worksheet" | "solutions";
  lessonId?: string;
  href: string;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  arabicName: string;
  usdMonthly: number;
  usdTerm: number;
  includes: string;
};

export type PlatformSettings = {
  phone: string;
  whatsapp: string;
  contactNote: string;
  plans: SubscriptionPlan[];
  features: string[];
};

export type StoreData = {
  library: LibraryItem[];
  drafts: ContentDraft[];
  managerMessages: ManagerMessage[];
  outreach: OutreachDraft[];
  settings: PlatformSettings;
  studentChat: StudentChatMessage[];
  progress: ProgressEntry[];
  customLessons: AcademyLessonRecord[];
  scratchCards: ScratchCard[];
  quizAttempts: QuizAttempt[];
  customQuestions: QuizQuestion[];
  entitlements: Entitlement[];
  exams: ExamPaper[];
};

export type AcademyLessonRecord = {
  id: string;
  track: GradeTrack;
  gradeLabel: string;
  chapter: number;
  title: string;
  arabicTitle: string;
  idea: string;
  board: string;
  example: string;
  exampleBoard: string;
};
