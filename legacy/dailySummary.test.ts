import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLMMock, snapshotMock, createSummaryMock, createMessageMock, createAssignmentMock, createProposalMock, weeklyDataMock, createWeeklyReportMock, reviewWeeklyReportMock, createParentLinkMock, listParentLinksMock, acceptParentLinkMock, revokeParentLinkMock, consentMock, myLinksMock, canDeliverMock } = vi.hoisted(() => ({
  invokeLLMMock: vi.fn(),
  snapshotMock: vi.fn(),
  createSummaryMock: vi.fn(),
  createMessageMock: vi.fn(),
  createAssignmentMock: vi.fn(),
  createProposalMock: vi.fn(),
  weeklyDataMock: vi.fn(),
  createWeeklyReportMock: vi.fn(),
  reviewWeeklyReportMock: vi.fn(),
  createParentLinkMock: vi.fn(),
  listParentLinksMock: vi.fn(),
  acceptParentLinkMock: vi.fn(),
  revokeParentLinkMock: vi.fn(),
  consentMock: vi.fn(),
  myLinksMock: vi.fn(),
  canDeliverMock: vi.fn(),
}));

vi.mock("./_core/llm", () => ({ invokeLLM: invokeLLMMock }));
vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getMiddleSchoolDailySnapshot: snapshotMock, createDailyStudentSummary: createSummaryMock, createManagerMessage: createMessageMock, createAssignment: createAssignmentMock, createManagerProposal: createProposalMock, getWeeklyParentReportData: weeklyDataMock, createWeeklyParentReport: createWeeklyReportMock, reviewWeeklyParentReport: reviewWeeklyReportMock, createParentStudentLink: createParentLinkMock, listParentStudentLinks: listParentLinksMock, acceptParentStudentLink: acceptParentLinkMock, revokeParentStudentLink: revokeParentLinkMock, updateParentReportConsent: consentMock, getParentStudentLinksForUser: myLinksMock, canDeliverWeeklyParentReport: canDeliverMock };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { aggregateDailyStudentMetrics, buildWeeklyParentReportData } from "../shared/dailySummary";

const emptySnapshot = { summaryDate: "2026-08-28", students: [], totals: { students: 0, completedTasks: 0, openTasks: 0, homeworkSubmissions: 0, accuracy: null } };

function context(role: "admin" | "user", email = role === "user" ? "parent@example.com" : "professor@example.com"): TrpcContext {
  return { user: { id: 7, role, email } as TrpcContext["user"], req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("daily middle-school review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    snapshotMock.mockResolvedValue(emptySnapshot);
    createSummaryMock.mockResolvedValue({});
    createMessageMock.mockResolvedValue({});
    createAssignmentMock.mockResolvedValue({});
    createWeeklyReportMock.mockResolvedValue({});
    createParentLinkMock.mockResolvedValue({ inviteToken: "a".repeat(64) });
    listParentLinksMock.mockResolvedValue([]);
    acceptParentLinkMock.mockResolvedValue({ status: "accepted", reportConsent: "confirmed", studentId: 19 });
    revokeParentLinkMock.mockResolvedValue({});
    consentMock.mockResolvedValue({});
    myLinksMock.mockResolvedValue([]);
    canDeliverMock.mockResolvedValue(false);
    weeklyDataMock.mockResolvedValue({ weekStart: "2026-08-24", weekEnd: "2026-08-30", cohort: "middle_school", student: { userId: 7, name: "Maya", completedTasks: 3, openTasks: 1, overdueTasks: 0, homeworkSubmissions: 2, accuracy: 80, priorityCohort: true, presentSessions: 2, absentSessions: 0, participationSeconds: 4200, engagementEvents: 5, submittedWorkCount: 2, participationRate: 100, lowEngagement: false, followUpType: null, recommendation: null, taskDraft: null, nextAction: "Continue with the next lesson" } });
    invokeLLMMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ overview: "No middle-school activity is recorded yet.", priorities: [], studentsNeedingAttention: [], professorQuestions: ["Would you like to connect more student records?"] }) } }] });
  });

  it("returns an empty, grounded cohort when no middle-school records exist", async () => {
    const result = await appRouter.createCaller(context("admin")).academy.middleSchoolDailySnapshot();
    expect(result.totals.students).toBe(0);
    expect(result.students).toEqual([]);
  });

  it("blocks daily student data for non-professors", async () => {
    await expect(appRouter.createCaller(context("user")).academy.middleSchoolDailySnapshot()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aggregates populated task data, overdue work, accuracy, and Grade 9 priority", () => {
    const result = aggregateDailyStudentMetrics({
      progress: [{ userId: 7, lessonId: 91, percent: 100 }, { userId: 7, lessonId: 92, percent: 40 }],
      assignments: [{ userId: 7, lessonId: 91, status: "assigned", dueDate: new Date("2026-08-27T00:00:00Z") }, { userId: 7, lessonId: 92, status: "completed", dueDate: null }],
      homework: [{ userId: 7, lessonId: 91 }],
      attempts: [{ userId: 7, questionId: 501, isCorrect: 1 }, { userId: 7, questionId: 502, isCorrect: 0 }],
      attendance: [{ userId: 7, sessionDate: "2026-08-28", sessionTitle: "Algebra workshop", status: "present", joinDurationSeconds: 2700, engagementEvents: 4, submittedWorkCount: 1 }, { userId: 7, sessionDate: "2026-08-28", sessionTitle: "Geometry clinic", status: "absent", joinDurationSeconds: 0, engagementEvents: 0, submittedWorkCount: 0 }],
      questionIds: new Set([501, 502]),
      grade9LessonIds: new Set([91]),
      names: [{ id: 7, name: "Maya" }],
      now: new Date("2026-08-28T00:00:00Z"),
    });
    expect(result.attendance).toMatchObject({ sessions: 2, records: 2, present: 1, absent: 1, engagementEvents: 4, submittedWorkCount: 1 });
    expect(result.totals).toMatchObject({ students: 1, priorityStudents: 1, completedTasks: 2, openTasks: 2, overdueTasks: 1, homeworkSubmissions: 1, accuracy: 50, presentStudents: 1, absentStudents: 1, engagedStudents: 1 });
    expect(result.students[0]).toMatchObject({ name: "Maya", priorityCohort: true, overdueTasks: 1, presentSessions: 1, absentSessions: 1, participationSeconds: 2700, engagementEvents: 4, participationRate: 50, lowEngagement: true, followUpType: "missed_session", recommendation: "Invite the student to review the missed interactive session. Also review 1 overdue task.", taskDraft: "10-minute session recap · Review the recording or notes and answer two checkpoint questions. Also review 1 overdue task.", nextAction: "Review missed interactive session" });
  });

  it("flags a present student with no engagement for a participation check-in", () => {
    const result = aggregateDailyStudentMetrics({ progress: [], assignments: [], homework: [], attempts: [], attendance: [{ userId: 8, sessionDate: "2026-08-28", sessionTitle: "Functions clinic", status: "late", joinDurationSeconds: 300, engagementEvents: 0, submittedWorkCount: 0 }], questionIds: new Set(), grade9LessonIds: new Set(), names: [{ id: 8, name: "Omar" }] });
    expect(result.students[0]).toMatchObject({ name: "Omar", presentSessions: 1, absentSessions: 0, engagementEvents: 0, lowEngagement: true, followUpType: "no_engagement", recommendation: "Check in and ask the student to complete a short recap.", taskDraft: "Quick participation reset · Submit one worked example and one question from the session.", nextAction: "Check in about interactive-session participation" });
  });

  it("keeps attendance metrics empty when a populated cohort has no session records", () => {
    const result = aggregateDailyStudentMetrics({ progress: [{ userId: 9, lessonId: 101, percent: 60 }], assignments: [], homework: [], attempts: [], attendance: [], questionIds: new Set(), grade9LessonIds: new Set(), names: [{ id: 9, name: "Lina" }] });
    expect(result.attendance).toMatchObject({ sessions: 0, records: 0, present: 0, absent: 0, engagementEvents: 0 });
    expect(result.students[0]).toMatchObject({ name: "Lina", participationRate: null, presentSessions: 0, absentSessions: 0 });
  });

  it("passes a due date through professor assignment creation", async () => {
    const dueDate = new Date("2026-08-30T00:00:00Z");
    await appRouter.createCaller(context("admin")).academy.assignWork({ userId: 19, lessonId: 91, title: "Algebra practice", dueDate });
    expect(createAssignmentMock).toHaveBeenCalledWith({ userId: 19, lessonId: 91, title: "Algebra practice", dueDate });
  });

  it("keeps personalized attendance follow-up professor-gated", async () => {
    const proposal = { proposalType: "operations" as const, audience: "all" as const, title: "Interactive attendance follow-up", summary: "Prepare a personalized follow-up draft. Professor approval is required before any student message or assignment." };
    await expect(appRouter.createCaller(context("user")).academy.createManagerProposal(proposal)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const result = await appRouter.createCaller(context("admin")).academy.createManagerProposal(proposal);
    expect(result.status).toBe("awaiting_approval");
    expect(createProposalMock).toHaveBeenCalledWith(expect.objectContaining({ title: proposal.title, status: "awaiting_approval" }));
    expect(createMessageMock).toHaveBeenCalledWith(expect.objectContaining({ direction: "manager", status: "open" }));
    expect(createAssignmentMock).not.toHaveBeenCalled();
    expect(createMessageMock.mock.calls.every(([message]) => message.direction !== "student")).toBe(true);
  });

  it("builds a weekly student report snapshot from recorded metrics", () => {
    const result = buildWeeklyParentReportData({ studentId: 7, studentName: "Maya", weekStart: "2026-08-24", weekEnd: "2026-08-30", progress: [{ userId: 7, lessonId: 91, percent: 100 }], assignments: [{ userId: 7, lessonId: 91, status: "completed", dueDate: null }], homework: [{ userId: 7, lessonId: 91 }], attempts: [{ userId: 7, questionId: 501, isCorrect: 1 }, { userId: 7, questionId: 502, isCorrect: 0 }], attendance: [{ userId: 7, sessionDate: "2026-08-25", sessionTitle: "Algebra workshop", status: "present", joinDurationSeconds: 1800, engagementEvents: 2, submittedWorkCount: 1 }], questionIds: new Set([501, 502]), grade9LessonIds: new Set([91]), now: new Date("2026-08-30T00:00:00Z") });
    expect(result).toMatchObject({ weekStart: "2026-08-24", weekEnd: "2026-08-30", student: { userId: 7, name: "Maya", completedTasks: 2, accuracy: 50, presentSessions: 1, submittedWorkCount: 1, priorityCohort: true } });
  });

  it("keeps an empty weekly report grounded when no student activity exists", () => {
    const result = buildWeeklyParentReportData({ studentId: 18, studentName: "Nour", weekStart: "2026-08-24", weekEnd: "2026-08-30", progress: [], assignments: [], homework: [], attempts: [], attendance: [], questionIds: new Set(), grade9LessonIds: new Set() });
    expect(result.student).toMatchObject({ userId: 18, name: "Nour", completedTasks: 0, openTasks: 0, accuracy: null, presentSessions: 0, absentSessions: 0, participationRate: null, lowEngagement: false });
  });

  it("keeps weekly parent reports professor-only and awaiting approval", async () => {
    await expect(appRouter.createCaller(context("user")).academy.createWeeklyParentReport({ studentId: 7, weekStart: "2026-08-24", weekEnd: "2026-08-30" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const result = await appRouter.createCaller(context("admin")).academy.createWeeklyParentReport({ studentId: 7, weekStart: "2026-08-24", weekEnd: "2026-08-30", consentStatus: "unknown" });
    expect(result.status).toBe("awaiting_approval");
    expect(createWeeklyReportMock).toHaveBeenCalledWith(expect.objectContaining({ studentId: 7, status: "awaiting_approval", deliveryChannel: "in_app", consentStatus: "unknown" }));
    expect(createMessageMock).toHaveBeenCalledWith(expect.objectContaining({ direction: "manager", status: "open" }));
    expect(createMessageMock.mock.calls.every(([message]) => message.direction !== "student")).toBe(true);
  });

  it("persists professor edits while keeping the weekly report awaiting approval", async () => {
    reviewWeeklyReportMock.mockResolvedValue({});
    await expect(appRouter.createCaller(context("user")).academy.reviewWeeklyParentReport({ id: 44, status: "awaiting_approval", englishSummary: "Unauthorized edit", arabicSummary: "تعديل غير مصرح" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reviewWeeklyReportMock).not.toHaveBeenCalled();
    const result = await appRouter.createCaller(context("admin")).academy.reviewWeeklyParentReport({ id: 44, status: "awaiting_approval", professorNote: "Edited for clarity.", englishSummary: "Updated English summary.", arabicSummary: "ملخص عربي محدث." });
    expect(result.status).toBe("awaiting_approval");
    expect(reviewWeeklyReportMock).toHaveBeenCalledWith(44, "awaiting_approval", "Edited for clarity.", "Updated English summary.", "ملخص عربي محدث.");
    expect(createWeeklyReportMock).not.toHaveBeenCalled();
  });

  it("keeps parent-link management professor-only and creates a one-time invitation", async () => {
    await expect(appRouter.createCaller(context("user")).academy.parentStudentLinks()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const expiresAt = new Date("2026-09-06T00:00:00Z");
    const result = await appRouter.createCaller(context("admin")).academy.createParentStudentLink({ studentId: 19, inviteEmail: "parent@example.com", expiresAt });
    expect(result).toMatchObject({ success: true, status: "pending", inviteToken: "a".repeat(64) });
    expect(createParentLinkMock).toHaveBeenCalledWith({ studentId: 19, inviteEmail: "parent@example.com", expiresAt });
  });

  it("requires the authenticated parent email and preserves consent boundaries", async () => {
    await expect(appRouter.createCaller(context("user", "")).academy.acceptParentStudentLink({ token: "a".repeat(64), consent: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const result = await appRouter.createCaller(context("user", "parent@example.com")).academy.acceptParentStudentLink({ token: "a".repeat(64), consent: true });
    expect(result).toMatchObject({ success: true, status: "accepted", reportConsent: "confirmed", studentId: 19 });
    expect(acceptParentLinkMock).toHaveBeenCalledWith("a".repeat(64), 7, "parent@example.com", true);
    await expect(appRouter.createCaller(context("user")).academy.revokeParentStudentLink({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks weekly report approval until an accepted link has active consent", async () => {
    await expect(appRouter.createCaller(context("admin")).academy.reviewWeeklyParentReport({ id: 44, status: "approved" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(reviewWeeklyReportMock).not.toHaveBeenCalled();
    canDeliverMock.mockResolvedValue(true);
    await appRouter.createCaller(context("admin")).academy.reviewWeeklyParentReport({ id: 44, status: "approved" });
    expect(reviewWeeklyReportMock).toHaveBeenCalledWith(44, "approved", undefined, undefined, undefined);
  });

  it("stores the AI synthesis as awaiting approval and never sends a student action", async () => {
    const result = await appRouter.createCaller(context("admin")).academy.createDailyMiddleSchoolSummary();
    expect(result.status).toBe("awaiting_approval");
    expect(createSummaryMock).toHaveBeenCalledWith(expect.objectContaining({ status: "awaiting_approval", cohort: "middle_school" }));
    expect(createMessageMock).toHaveBeenCalledWith(expect.objectContaining({ direction: "manager", status: "open" }));
    expect(createMessageMock.mock.calls[0][0].body).toContain("No student message");
    expect(invokeLLMMock.mock.calls[0][0].messages[0].content).toContain("Do not invent students");
  });
});
