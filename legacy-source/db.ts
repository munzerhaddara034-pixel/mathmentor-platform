import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, learningPaths, lessons, progress, subscriptionRequests, diagnosticAttempts, homeworkSubmissions, contestAttempts, contentApprovals, attempts, assignments, questions, contestContents, managerProposals, managerMessages, dailyStudentSummaries, interactiveAttendance, weeklyParentReports, parentStudentLinks, schoolLeads, schoolOutreachDrafts, examAttempts, lessonAttempts, solutionAssets } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { aggregateDailyStudentMetrics, buildWeeklyParentReportData } from "../shared/dailySummary";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) return;
  const values: InsertUser = { openId: user.openId }; const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date(); if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }
export async function listLearningPaths() { const db = await getDb(); if (!db) return []; return db.select().from(learningPaths).orderBy(learningPaths.track, learningPaths.level); }
export async function listLessons(pathId: number) { const db = await getDb(); if (!db) return []; return db.select().from(lessons).where(eq(lessons.pathId, pathId)).orderBy(lessons.sortOrder); }
export async function saveProgress(userId: number, lessonId: number, percent: number) { const db = await getDb(); if (!db) return; await db.insert(progress).values({ userId, lessonId, percent }); }
export async function listProgress(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(progress).where(eq(progress.userId, userId)).orderBy(desc(progress.updatedAt)); }
export async function createSubscriptionRequest(userId: number, reference?: string, receiptUrl?: string) { const db = await getDb(); if (!db) return undefined; return db.insert(subscriptionRequests).values({ userId, reference, receiptUrl }); }
export async function listSubscriptionRequests() { const db = await getDb(); if (!db) return []; return db.select().from(subscriptionRequests).orderBy(desc(subscriptionRequests.createdAt)); }
export async function saveDiagnosticAttempt(values: typeof diagnosticAttempts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(diagnosticAttempts).values(values); }
export async function saveExamAttempt(values: typeof examAttempts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(examAttempts).values(values); }
export async function saveLessonAttempt(values: typeof lessonAttempts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(lessonAttempts).values(values); }
export async function listLessonAttempts(userId: number, lessonSlug?: string) { const db = await getDb(); if (!db) return []; const filters = lessonSlug ? and(eq(lessonAttempts.userId, userId), eq(lessonAttempts.lessonSlug, lessonSlug)) : eq(lessonAttempts.userId, userId); return db.select().from(lessonAttempts).where(filters).orderBy(desc(lessonAttempts.createdAt)); }
export async function deleteLessonAttempt(userId: number, attemptId: number) { const db = await getDb(); if (!db) return undefined; return db.delete(lessonAttempts).where(and(eq(lessonAttempts.id, attemptId), eq(lessonAttempts.userId, userId))); }
export async function deleteLessonAttempts(userId: number, attemptIds: number[]) { const db = await getDb(); if (!db || !attemptIds.length) return undefined; return db.delete(lessonAttempts).where(and(eq(lessonAttempts.userId, userId), inArray(lessonAttempts.id, attemptIds))); }
export async function listExamAttempts(userId: number, specialization?: string) { const db = await getDb(); if (!db) return []; const filters = specialization ? and(eq(examAttempts.userId, userId), eq(examAttempts.specialization, specialization)) : eq(examAttempts.userId, userId); return db.select().from(examAttempts).where(filters).orderBy(desc(examAttempts.createdAt)); }
export async function listDiagnosticAttempts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(diagnosticAttempts).where(eq(diagnosticAttempts.userId, userId)).orderBy(desc(diagnosticAttempts.createdAt)); }
export async function saveHomeworkSubmission(values: typeof homeworkSubmissions.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(homeworkSubmissions).values(values); }
export async function listHomeworkSubmissions(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.userId, userId)).orderBy(desc(homeworkSubmissions.createdAt)); }
export async function saveContestAttempt(values: typeof contestAttempts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(contestAttempts).values(values); }
export async function listContestAttempts(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(contestAttempts).where(eq(contestAttempts.userId, userId)).orderBy(desc(contestAttempts.createdAt)); }
export async function listTopContestAttempts() { const db = await getDb(); if (!db) return []; return db.select().from(contestAttempts).orderBy(desc(contestAttempts.score)).limit(10); }
export async function listPublishedContests() { const db = await getDb(); if (!db) return []; return db.select().from(contestContents).where(eq(contestContents.isPublished, 1)).orderBy(desc(contestContents.createdAt)); }
export async function listAllContestContents() { const db = await getDb(); if (!db) return []; return db.select().from(contestContents).orderBy(desc(contestContents.createdAt)); }
export async function listQuestionsForLesson(lessonId: number) { const db = await getDb(); if (!db) return []; return db.select().from(questions).where(eq(questions.lessonId, lessonId)).orderBy(questions.id); }
export async function publishContest(contentId: number) { const db = await getDb(); if (!db) return undefined; return db.update(contestContents).set({ isPublished: 1 }).where(eq(contestContents.id, contentId)); }
export async function recordAttempt(values: typeof attempts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(attempts).values(values); }
export async function createAssignment(values: typeof assignments.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(assignments).values(values); }
export async function listAssignments(userId: number) { const db = await getDb(); if (!db) return []; return db.select().from(assignments).where(eq(assignments.userId, userId)).orderBy(desc(assignments.createdAt)); }
export async function markQuestionForReview(questionId: number, professorFeedback: string) { const db = await getDb(); if (!db) return undefined; return db.update(questions).set({ reviewStatus: "needs_professor", professorFeedback }).where(eq(questions.id, questionId)); }
export async function createApproval(values: typeof contentApprovals.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(contentApprovals).values(values); }
export async function applyApproval(contentType: "lesson" | "contest" | "assignment" | "access", contentId: number | undefined, action: "publish" | "assign" | "activate" | "request_changes", note?: string) { const db = await getDb(); if (!db) return undefined; await db.insert(contentApprovals).values({ contentType, contentId, action, status: action === "request_changes" ? "rejected" : "approved", note }); if (action === "publish" && contentId && contentType === "lesson") await db.update(lessons).set({ isPublished: 1 }).where(eq(lessons.id, contentId)); if (action === "publish" && contentId && contentType === "contest") await publishContest(contentId); if (action === "assign" && contentId) await db.insert(assignments).values({ userId: contentId, title: note || "Academy assignment" }); if (action === "activate" && contentId) await db.update(subscriptionRequests).set({ status: "approved", reviewedAt: new Date() }).where(eq(subscriptionRequests.id, contentId)); return { success: true, action, contentId }; }
export async function listApprovals() { const db = await getDb(); if (!db) return []; return db.select().from(contentApprovals).orderBy(desc(contentApprovals.createdAt)); }
export async function createSchoolLead(values: typeof schoolLeads.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(schoolLeads).values(values); }
export async function listSchoolLeads() { const db = await getDb(); if (!db) return []; return db.select().from(schoolLeads).orderBy(desc(schoolLeads.createdAt)); }
export async function createSchoolOutreachDraft(values: typeof schoolOutreachDrafts.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(schoolOutreachDrafts).values(values); }
export async function listSchoolOutreachDrafts() { const db = await getDb(); if (!db) return []; return db.select().from(schoolOutreachDrafts).orderBy(desc(schoolOutreachDrafts.createdAt)); }
export async function createSolutionAsset(values: typeof solutionAssets.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(solutionAssets).values(values); }
export async function listSolutionAssets(status?: "draft" | "awaiting_approval" | "approved" | "rejected" | "changes_requested") { const db = await getDb(); if (!db) return []; return db.select().from(solutionAssets).where(status ? eq(solutionAssets.status, status) : undefined).orderBy(desc(solutionAssets.createdAt)); }
export async function reviewSolutionAsset(id: number, reviewedBy: number, status: "approved" | "rejected" | "changes_requested", professorNote?: string) { const db = await getDb(); if (!db) return undefined; return db.update(solutionAssets).set({ status, professorNote, reviewedBy, reviewedAt: new Date() }).where(eq(solutionAssets.id, id)); }
export async function reviewSolutionAssets(ids: number[], reviewedBy: number, status: "approved" | "rejected", professorNote?: string) { const db = await getDb(); const uniqueIds = Array.from(new Set(ids)); if (!db || !uniqueIds.length) return { success: false, requestedCount: 0 }; await db.update(solutionAssets).set({ status, professorNote, reviewedBy, reviewedAt: new Date() }).where(and(inArray(solutionAssets.id, uniqueIds), eq(solutionAssets.status, "awaiting_approval"))); return { success: true, requestedCount: uniqueIds.length, status }; }
export async function reviewSchoolOutreachDraft(id: number, status: "approved" | "rejected" | "awaiting_approval", professorNote?: string) { const db = await getDb(); if (!db) return undefined; return db.update(schoolOutreachDrafts).set({ status, professorNote, reviewedAt: status === "awaiting_approval" ? null : new Date() }).where(eq(schoolOutreachDrafts.id, id)); }

export async function createManagerProposal(values: typeof managerProposals.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(managerProposals).values(values); }
export async function listManagerProposals() { const db = await getDb(); if (!db) return []; return db.select().from(managerProposals).orderBy(desc(managerProposals.createdAt)); }
export async function decideManagerProposal(id: number, status: "approved" | "rejected", decisionNote?: string) { const db = await getDb(); if (!db) return undefined; return db.update(managerProposals).set({ status, decisionNote, reviewedAt: new Date() }).where(eq(managerProposals.id, id)); }
export async function createManagerMessage(values: typeof managerMessages.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(managerMessages).values(values); }
export async function listManagerMessages() { const db = await getDb(); if (!db) return []; return db.select().from(managerMessages).orderBy(desc(managerMessages.createdAt)); }
export async function resolveManagerMessage(id: number) { const db = await getDb(); if (!db) return undefined; return db.update(managerMessages).set({ status: "resolved" }).where(eq(managerMessages.id, id)); }

export async function getMiddleSchoolDailySnapshot() {
  const db = await getDb();
  if (!db) return { summaryDate: new Date().toISOString().slice(0, 10), students: [], attendance: { sessions: 0, records: 0, present: 0, late: 0, absent: 0, excused: 0, engagementEvents: 0, submittedWorkCount: 0 }, totals: { students: 0, priorityStudents: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0, homeworkSubmissions: 0, accuracy: null as number | null, presentStudents: 0, absentStudents: 0, engagedStudents: 0 } };
  const allPaths = await db.select().from(learningPaths);
  const trackedPaths = allPaths.filter(path => path.level === "middle" || /grade[ -]?9/i.test(`${path.slug} ${path.title}`));
  const grade9PathIds = new Set(allPaths.filter(path => /grade[ -]?9/i.test(`${path.slug} ${path.title}`)).map(path => path.id));
  const pathIds = trackedPaths.map(path => path.id);
  if (!pathIds.length) return { summaryDate: new Date().toISOString().slice(0, 10), students: [], attendance: { sessions: 0, records: 0, present: 0, late: 0, absent: 0, excused: 0, engagementEvents: 0, submittedWorkCount: 0 }, totals: { students: 0, priorityStudents: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0, homeworkSubmissions: 0, accuracy: null as number | null, presentStudents: 0, absentStudents: 0, engagedStudents: 0 } };
  const middleLessons = await db.select().from(lessons).where(inArray(lessons.pathId, pathIds));
  const lessonIds = middleLessons.map(lesson => lesson.id);
  const grade9LessonIds = new Set(middleLessons.filter(lesson => grade9PathIds.has(lesson.pathId)).map(lesson => lesson.id));
  if (!lessonIds.length) return { summaryDate: new Date().toISOString().slice(0, 10), students: [], attendance: { sessions: 0, records: 0, present: 0, late: 0, absent: 0, excused: 0, engagementEvents: 0, submittedWorkCount: 0 }, totals: { students: 0, priorityStudents: 0, completedTasks: 0, openTasks: 0, overdueTasks: 0, homeworkSubmissions: 0, accuracy: null as number | null, presentStudents: 0, absentStudents: 0, engagedStudents: 0 } };
  const summaryDate = new Date().toISOString().slice(0, 10);
  const [allProgress, allAssignments, allHomework, allQuestions, allAttempts, allUsers, allAttendance] = await Promise.all([
    db.select().from(progress).where(inArray(progress.lessonId, lessonIds)),
    db.select().from(assignments).where(inArray(assignments.lessonId, lessonIds)),
    db.select().from(homeworkSubmissions).where(inArray(homeworkSubmissions.lessonId, lessonIds)),
    db.select().from(questions).where(inArray(questions.lessonId, lessonIds)),
    db.select().from(attempts),
    db.select().from(users),
    db.select().from(interactiveAttendance).where(eq(interactiveAttendance.sessionDate, summaryDate)),
  ]);
  const metrics = aggregateDailyStudentMetrics({ progress: allProgress, assignments: allAssignments, homework: allHomework, attempts: allAttempts, attendance: allAttendance, questionIds: new Set(allQuestions.map(question => question.id)), grade9LessonIds, names: allUsers.map(user => ({ id: user.id, name: user.name })) });
  return { summaryDate, ...metrics };
}

export async function recordInteractiveAttendance(values: typeof interactiveAttendance.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(interactiveAttendance).values(values); }
export async function listInteractiveAttendance(sessionDate?: string) { const db = await getDb(); if (!db) return []; return sessionDate ? db.select().from(interactiveAttendance).where(eq(interactiveAttendance.sessionDate, sessionDate)) : db.select().from(interactiveAttendance).orderBy(desc(interactiveAttendance.createdAt)); }
export async function createDailyStudentSummary(values: typeof dailyStudentSummaries.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(dailyStudentSummaries).values(values); }
export async function listDailyStudentSummaries() { const db = await getDb(); if (!db) return []; return db.select().from(dailyStudentSummaries).orderBy(desc(dailyStudentSummaries.createdAt)); }
export async function reviewDailyStudentSummary(id: number, status: "reviewed" | "awaiting_approval") { const db = await getDb(); if (!db) return undefined; return db.update(dailyStudentSummaries).set({ status, reviewedAt: status === "reviewed" ? new Date() : null }).where(eq(dailyStudentSummaries.id, id)); }

export async function getWeeklyParentReportData(studentId: number, weekStart: string, weekEnd: string) {
  const db = await getDb();
  if (!db) return undefined;
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(`${weekEnd}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const allPaths = await db.select().from(learningPaths);
  const trackedPaths = allPaths.filter(path => path.level === "middle" || /grade[ -]?9/i.test(`${path.slug} ${path.title}`));
  const grade9PathIds = new Set(allPaths.filter(path => /grade[ -]?9/i.test(`${path.slug} ${path.title}`)).map(path => path.id));
  const pathIds = trackedPaths.map(path => path.id);
  if (!pathIds.length) return buildWeeklyParentReportData({ studentId, studentName: null, weekStart, weekEnd, progress: [], assignments: [], homework: [], attempts: [], attendance: [], questionIds: new Set(), grade9LessonIds: new Set() });
  const middleLessons = await db.select().from(lessons).where(inArray(lessons.pathId, pathIds));
  const lessonIds = middleLessons.map(lesson => lesson.id);
  const grade9LessonIds = new Set(middleLessons.filter(lesson => grade9PathIds.has(lesson.pathId)).map(lesson => lesson.id));
  const [studentRows, allProgress, allAssignments, allHomework, allQuestions, allAttempts, allAttendance] = await Promise.all([
    db.select().from(users).where(eq(users.id, studentId)).limit(1),
    db.select().from(progress).where(inArray(progress.lessonId, lessonIds)),
    db.select().from(assignments).where(inArray(assignments.lessonId, lessonIds)),
    db.select().from(homeworkSubmissions).where(inArray(homeworkSubmissions.lessonId, lessonIds)),
    db.select().from(questions).where(inArray(questions.lessonId, lessonIds)),
    db.select().from(attempts),
    db.select().from(interactiveAttendance),
  ]);
  const inRange = (date: Date | null | undefined) => Boolean(date && date.getTime() >= start.getTime() && date.getTime() < end.getTime());
  const studentProgress = allProgress.filter(row => row.userId === studentId && inRange(row.updatedAt));
  const studentAssignments = allAssignments.filter(row => row.userId === studentId && (inRange(row.createdAt) || row.status === "assigned"));
  const studentHomework = allHomework.filter(row => row.userId === studentId && inRange(row.createdAt));
  const questionIds = new Set(allQuestions.map(question => question.id));
  const studentAttempts = allAttempts.filter(row => row.userId === studentId && inRange(row.createdAt));
  const studentAttendance = allAttendance.filter(row => row.userId === studentId && row.sessionDate >= weekStart && row.sessionDate <= weekEnd);
  return buildWeeklyParentReportData({ studentId, studentName: studentRows[0]?.name ?? null, weekStart, weekEnd, progress: studentProgress, assignments: studentAssignments, homework: studentHomework, attempts: studentAttempts, attendance: studentAttendance, questionIds, grade9LessonIds, now: new Date() });
}

export async function createWeeklyParentReport(values: typeof weeklyParentReports.$inferInsert) { const db = await getDb(); if (!db) return undefined; return db.insert(weeklyParentReports).values(values); }
export async function listWeeklyParentReports() { const db = await getDb(); if (!db) return []; return db.select().from(weeklyParentReports).orderBy(desc(weeklyParentReports.createdAt)); }
export async function reviewWeeklyParentReport(id: number, status: "approved" | "rejected" | "awaiting_approval", professorNote?: string, englishSummary?: string, arabicSummary?: string) { const db = await getDb(); if (!db) return undefined; const updates: Partial<typeof weeklyParentReports.$inferInsert> = { status, professorNote, reviewedAt: status === "approved" || status === "rejected" ? new Date() : null }; if (englishSummary !== undefined) updates.englishSummary = englishSummary; if (arabicSummary !== undefined) updates.arabicSummary = arabicSummary; return db.update(weeklyParentReports).set(updates).where(eq(weeklyParentReports.id, id)); }

const hashInviteToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createParentStudentLink(values: Omit<typeof parentStudentLinks.$inferInsert, "inviteTokenHash" | "status" | "reportConsent">) {
  const db = await getDb(); if (!db) return undefined;
  const inviteToken = randomBytes(32).toString("hex");
  await db.insert(parentStudentLinks).values({ ...values, inviteTokenHash: hashInviteToken(inviteToken), status: "pending", reportConsent: "unknown" });
  return { inviteToken };
}

export async function listParentStudentLinks() { const db = await getDb(); if (!db) return []; return db.select().from(parentStudentLinks).orderBy(desc(parentStudentLinks.createdAt)); }
export async function acceptParentStudentLink(token: string, parentUserId: number, parentEmail: string, consent: boolean) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(parentStudentLinks).where(eq(parentStudentLinks.inviteTokenHash, hashInviteToken(token))).limit(1); const link = rows[0]; if (!link || link.status !== "pending" || link.expiresAt.getTime() <= Date.now() || link.inviteEmail.toLowerCase() !== parentEmail.toLowerCase()) return undefined; const now = new Date(); await db.update(parentStudentLinks).set({ parentUserId, status: "accepted", acceptedAt: now, reportConsent: consent ? "confirmed" : "unknown", consentedAt: consent ? now : null }).where(eq(parentStudentLinks.id, link.id)); return { ...link, parentUserId, status: "accepted" as const, reportConsent: consent ? "confirmed" as const : "unknown" as const, acceptedAt: now, consentedAt: consent ? now : null }; }
export async function revokeParentStudentLink(id: number) { const db = await getDb(); if (!db) return undefined; return db.update(parentStudentLinks).set({ status: "revoked", reportConsent: "revoked", revokedAt: new Date() }).where(eq(parentStudentLinks.id, id)); }
export async function updateParentReportConsent(id: number, parentUserId: number, consent: boolean) { const db = await getDb(); if (!db) return undefined; const now = new Date(); return db.update(parentStudentLinks).set({ reportConsent: consent ? "confirmed" : "revoked", consentedAt: consent ? now : null, revokedAt: consent ? null : now }).where(and(eq(parentStudentLinks.id, id), eq(parentStudentLinks.parentUserId, parentUserId), eq(parentStudentLinks.status, "accepted"))); }
export async function getParentStudentLinksForUser(parentUserId: number) { const db = await getDb(); if (!db) return []; return db.select().from(parentStudentLinks).where(and(eq(parentStudentLinks.parentUserId, parentUserId), eq(parentStudentLinks.status, "accepted"))); }
export async function canDeliverWeeklyParentReport(reportId: number) { const db = await getDb(); if (!db) return false; const rows = await db.select({ id: parentStudentLinks.id }).from(weeklyParentReports).innerJoin(parentStudentLinks, eq(weeklyParentReports.studentId, parentStudentLinks.studentId)).where(and(eq(weeklyParentReports.id, reportId), eq(parentStudentLinks.status, "accepted"), eq(parentStudentLinks.reportConsent, "confirmed"))).limit(1); return Boolean(rows[0]); }
