import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const learningPaths = mysqlTable("learning_paths", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  track: mysqlEnum("track", ["lebanese", "sat"]).notNull(),
  level: mysqlEnum("level", ["middle", "secondary", "sat"]).notNull(),
  isPremium: int("isPremium").default(1).notNull(),
  isPublished: int("isPublished").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const topics = mysqlTable("topics", {
  id: int("id").autoincrement().primaryKey(),
  pathId: int("pathId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  pathId: int("pathId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  topic: varchar("topic", { length: 120 }).notNull(),
  body: text("body").notNull(),
  videoUrl: text("videoUrl"),
  transcript: text("transcript"),
  sourceReference: varchar("sourceReference", { length: 255 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPublished: int("isPublished").default(1).notNull(),
});

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId"),
  title: varchar("title", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["assigned", "completed", "reviewed"]).default("assigned").notNull(),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const contestContents = mysqlTable("contest_contents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  lessonId: int("lessonId"),
  topic: varchar("topic", { length: 120 }).notNull(),
  durationSeconds: int("durationSeconds").default(120).notNull(),
  isPublished: int("isPublished").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lessonId").notNull(),
  prompt: text("prompt").notNull(),
  answer: varchar("answer", { length: 255 }).notNull(),
  explanation: text("explanation").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["automatic", "needs_professor", "reviewed"]).default("automatic").notNull(),
  professorFeedback: text("professorFeedback"),
});

export const attempts = mysqlTable("attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  questionId: int("questionId").notNull(),
  submittedAnswer: text("submittedAnswer").notNull(),
  isCorrect: int("isCorrect").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  assistantType: mysqlEnum("assistantType", ["tutor", "management", "payment"]).notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const progress = mysqlTable("progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId").notNull(),
  percent: int("percent").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const diagnosticAttempts = mysqlTable("diagnostic_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  track: mysqlEnum("track", ["lebanese", "sat"]).notNull(),
  score: int("score").default(0).notNull(),
  total: int("total").notNull(),
  recommendedTopic: varchar("recommendedTopic", { length: 180 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const homeworkSubmissions = mysqlTable("homework_submissions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonId: int("lessonId"),
  prompt: text("prompt").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentName: varchar("attachmentName", { length: 255 }),
  status: mysqlEnum("status", ["submitted", "reviewed", "needs_revision"]).default("submitted").notNull(),
  feedback: text("feedback"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const contestAttempts = mysqlTable("contest_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  contestId: int("contestId"),
  title: varchar("title", { length: 180 }).notNull(),
  score: int("score").default(0).notNull(),
  total: int("total").notNull(),
  durationSeconds: int("durationSeconds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const contentApprovals = mysqlTable("content_approvals", {
  id: int("id").autoincrement().primaryKey(),
  contentType: mysqlEnum("contentType", ["lesson", "contest", "assignment", "access"]).notNull(),
  contentId: int("contentId"),
  action: mysqlEnum("action", ["publish", "assign", "activate", "request_changes"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const managerProposals = mysqlTable("manager_proposals", {
  id: int("id").autoincrement().primaryKey(),
  proposalType: mysqlEnum("proposalType", ["pricing", "campaign", "operations"]).notNull(),
  audience: mysqlEnum("audience", ["grade9", "grade12", "sat", "all"]).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  summary: text("summary").notNull(),
  suggestedAmount: int("suggestedAmount"),
  currency: varchar("currency", { length: 8 }).default("USD").notNull(),
  suggestedBudget: int("suggestedBudget"),
  campaignChannel: varchar("campaignChannel", { length: 40 }),
  campaignCopy: text("campaignCopy"),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "approved", "rejected"]).default("awaiting_approval").notNull(),
  decisionNote: text("decisionNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const managerMessages = mysqlTable("manager_messages", {
  id: int("id").autoincrement().primaryKey(),
  direction: mysqlEnum("direction", ["manager", "professor"]).notNull(),
  subject: varchar("subject", { length: 180 }).notNull(),
  body: text("body").notNull(),
  relatedProposalId: int("relatedProposalId"),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const schoolLeads = mysqlTable("school_leads", {
  id: int("id").autoincrement().primaryKey(),
  schoolName: varchar("schoolName", { length: 180 }).notNull(),
  market: varchar("market", { length: 40 }).notNull(),
  country: varchar("country", { length: 80 }).notNull(),
  contactName: varchar("contactName", { length: 180 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactChannel: varchar("contactChannel", { length: 40 }),
  notes: text("notes"),
  status: mysqlEnum("status", ["new", "qualified", "contacted", "pilot_discussion", "won", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const schoolOutreachDrafts = mysqlTable("school_outreach_drafts", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  language: mysqlEnum("language", ["en", "ar"]).default("en").notNull(),
  subject: varchar("subject", { length: 180 }).notNull(),
  body: text("body").notNull(),
  channel: varchar("channel", { length: 40 }).default("email").notNull(),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "approved", "sent", "rejected"]).default("awaiting_approval").notNull(),
  professorNote: text("professorNote"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const interactiveAttendance = mysqlTable("interactive_attendance", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  sessionDate: varchar("sessionDate", { length: 10 }).notNull(),
  sessionTitle: varchar("sessionTitle", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["present", "absent", "late", "excused"]).notNull(),
  joinDurationSeconds: int("joinDurationSeconds").default(0).notNull(),
  engagementEvents: int("engagementEvents").default(0).notNull(),
  submittedWorkCount: int("submittedWorkCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const dailyStudentSummaries = mysqlTable("daily_student_summaries", {
  id: int("id").autoincrement().primaryKey(),
  summaryDate: varchar("summaryDate", { length: 10 }).notNull(),
  cohort: varchar("cohort", { length: 40 }).default("middle_school").notNull(),
  snapshot: text("snapshot").notNull(),
  summary: text("summary").notNull(),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "reviewed"]).default("awaiting_approval").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const weeklyParentReports = mysqlTable("weekly_parent_reports", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  weekStart: varchar("weekStart", { length: 10 }).notNull(),
  weekEnd: varchar("weekEnd", { length: 10 }).notNull(),
  snapshot: text("snapshot").notNull(),
  englishSummary: text("englishSummary").notNull(),
  arabicSummary: text("arabicSummary").notNull(),
  recipientLabel: varchar("recipientLabel", { length: 180 }),
  deliveryChannel: mysqlEnum("deliveryChannel", ["in_app", "whatsapp", "email"]).default("in_app").notNull(),
  consentStatus: mysqlEnum("consentStatus", ["unknown", "confirmed", "revoked"]).default("unknown").notNull(),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "approved", "sent", "rejected"]).default("awaiting_approval").notNull(),
  professorNote: text("professorNote"),
  reviewedAt: timestamp("reviewedAt"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const parentStudentLinks = mysqlTable("parent_student_links", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  parentUserId: int("parentUserId"),
  inviteEmail: varchar("inviteEmail", { length: 320 }).notNull(),
  inviteTokenHash: varchar("inviteTokenHash", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "revoked", "expired"]).default("pending").notNull(),
  reportConsent: mysqlEnum("reportConsent", ["unknown", "confirmed", "revoked"]).default("unknown").notNull(),
  consentScope: varchar("consentScope", { length: 80 }).default("weekly_parent_reports").notNull(),
  consentedAt: timestamp("consentedAt"),
  acceptedAt: timestamp("acceptedAt"),
  revokedAt: timestamp("revokedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const lessonAttempts = mysqlTable("lesson_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  lessonSlug: varchar("lessonSlug", { length: 120 }).notNull(),
  skill: varchar("skill", { length: 120 }).notNull(),
  language: mysqlEnum("language", ["en", "ar"]).default("en").notNull(),
  typedAnswer: text("typedAnswer").notNull(),
  solutionSteps: text("solutionSteps").notNull(),
  expectedAnswer: varchar("expectedAnswer", { length: 255 }).notNull(),
  explanation: text("explanation").notNull(),
  isCorrect: int("isCorrect").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const examAttempts = mysqlTable("exam_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  examId: varchar("examId", { length: 120 }).notNull(),
  specialization: varchar("specialization", { length: 80 }).notNull(),
  score: int("score").default(0).notNull(),
  total: int("total").notNull(),
  answered: int("answered").default(0).notNull(),
  percentage: int("percentage").default(0).notNull(),
  durationSeconds: int("durationSeconds").notNull(),
  timeSpentSeconds: int("timeSpentSeconds").default(0).notNull(),
  sectionSnapshot: text("sectionSnapshot").notNull(),
  skillSnapshot: text("skillSnapshot").notNull(),
  reviewSnapshot: text("reviewSnapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const solutionAssets = mysqlTable("solution_assets", {
  id: int("id").autoincrement().primaryKey(),
  skill: varchar("skill", { length: 120 }).notNull(),
  questionRef: varchar("questionRef", { length: 160 }).notNull(),
  videoScript: text("videoScript").notNull(),
  videoUrl: text("videoUrl"),
  printableSolution: text("printableSolution").notNull(),
  language: mysqlEnum("language", ["en", "ar"]).default("en").notNull(),
  status: mysqlEnum("status", ["draft", "awaiting_approval", "approved", "rejected", "changes_requested"]).default("awaiting_approval").notNull(),
  professorNote: text("professorNote"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const solutionReviewBatches = mysqlTable("solution_review_batches", {
  id: int("id").autoincrement().primaryKey(),
  actorUserId: int("actorUserId").notNull(),
  actorNameSnapshot: varchar("actorNameSnapshot", { length: 255 }).notNull(),
  decision: mysqlEnum("decision", ["approved", "rejected"]).notNull(),
  draftIdsSnapshot: text("draftIdsSnapshot").notNull(),
  draftRefsSnapshot: text("draftRefsSnapshot").notNull(),
  draftCount: int("draftCount").notNull(),
  professorNote: text("professorNote"),
  executedAt: timestamp("executedAt").defaultNow().notNull(),
});

export const subscriptionRequests = mysqlTable("subscription_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  paymentMethod: varchar("paymentMethod", { length: 40 }).default("whish_money").notNull(),
  reference: varchar("reference", { length: 120 }),
  receiptUrl: text("receiptUrl"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type LearningPath = typeof learningPaths.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type Progress = typeof progress.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
export type SolutionAsset = typeof solutionAssets.$inferSelect;
export type SolutionReviewBatch = typeof solutionReviewBatches.$inferSelect;
export type SubscriptionRequest = typeof subscriptionRequests.$inferSelect;
export type ManagerProposal = typeof managerProposals.$inferSelect;
export type ManagerMessage = typeof managerMessages.$inferSelect;
export type SchoolLead = typeof schoolLeads.$inferSelect;
export type SchoolOutreachDraft = typeof schoolOutreachDrafts.$inferSelect;
export type DiagnosticAttempt = typeof diagnosticAttempts.$inferSelect;
export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type ContestAttempt = typeof contestAttempts.$inferSelect;
export type ContentApproval = typeof contentApprovals.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type ContestContent = typeof contestContents.$inferSelect;
export type DailyStudentSummary = typeof dailyStudentSummaries.$inferSelect;
export type WeeklyParentReport = typeof weeklyParentReports.$inferSelect;
export type InteractiveAttendance = typeof interactiveAttendance.$inferSelect;
export type ParentStudentLink = typeof parentStudentLinks.$inferSelect;
