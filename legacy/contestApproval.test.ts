import { describe, expect, it, vi } from "vitest";

const { applyApprovalMock, saveContestAttemptMock, listQuestionsForLessonMock, createManagerProposalMock, createManagerMessageMock } = vi.hoisted(() => ({ applyApprovalMock: vi.fn(), saveContestAttemptMock: vi.fn(), listQuestionsForLessonMock: vi.fn(), createManagerProposalMock: vi.fn(), createManagerMessageMock: vi.fn() }));
vi.mock("./db", () => ({
  applyApproval: applyApprovalMock,
  createAssignment: vi.fn(),
  createManagerMessage: createManagerMessageMock,
  createManagerProposal: createManagerProposalMock,
  createSubscriptionRequest: vi.fn(),
  listApprovals: vi.fn(() => []),
  listAssignments: vi.fn(() => []),
  listContestAttempts: vi.fn(() => []),
  listDiagnosticAttempts: vi.fn(() => []),
  listHomeworkSubmissions: vi.fn(() => []),
  listLearningPaths: vi.fn(() => []),
  listPublishedContests: vi.fn(() => []),
  listAllContestContents: vi.fn(() => []),
  listQuestionsForLesson: listQuestionsForLessonMock,
  listManagerMessages: vi.fn(() => []),
  listManagerProposals: vi.fn(() => []),
  listLessons: vi.fn(() => []),
  listProgress: vi.fn(() => []),
  listSubscriptionRequests: vi.fn(() => []),
  listTopContestAttempts: vi.fn(() => []),
  markQuestionForReview: vi.fn(),
  decideManagerProposal: vi.fn(),
  recordAttempt: vi.fn(),
  saveContestAttempt: saveContestAttemptMock,
  saveDiagnosticAttempt: vi.fn(),
  saveHomeworkSubmission: vi.fn(),
  saveProgress: vi.fn(),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = { user: { id: 1, role: "admin" }, req: {}, res: {} } as unknown as TrpcContext;

describe("contest publishing approval", () => {
  it("blocks non-professor users from every manager action", async () => {
    const learnerContext = { user: { id: 2, role: "user" }, req: {}, res: {} } as unknown as TrpcContext;
    await expect(appRouter.createCaller(learnerContext).academy.managerProposals()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(learnerContext).academy.requestApproval({ contentType: "contest", contentId: 1, action: "publish" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(learnerContext).ai.operationsDraft({ proposalType: "pricing", audience: "grade9" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores a pricing proposal as awaiting professor approval", async () => {
    applyApprovalMock.mockClear();
    const result = await appRouter.createCaller(context).academy.createManagerProposal({ proposalType: "pricing", audience: "grade9", title: "Grade 9 plan", summary: "Confirm duration and support before pricing.", suggestedAmount: 40, currency: "USD" });
    expect(result).toEqual({ success: true, status: "awaiting_approval" });
    expect(createManagerProposalMock).toHaveBeenCalledWith(expect.objectContaining({ proposalType: "pricing", audience: "grade9", status: "awaiting_approval" }));
    expect(createManagerMessageMock).toHaveBeenCalledWith(expect.objectContaining({ direction: "manager", status: "open", body: expect.stringContaining("No financial") }));
    expect(applyApprovalMock).not.toHaveBeenCalled();
  });

  it("passes the selected contest content ID with publish", async () => {
    applyApprovalMock.mockResolvedValue({ success: true, action: "publish", contentId: 42 });
    const result = await appRouter.createCaller(context).academy.requestApproval({
      contentType: "contest",
      contentId: 42,
      action: "publish",
      note: "Publish the selected SAT contest.",
    });
    expect(result).toEqual({ success: true, action: "publish", contentId: 42 });
    expect(applyApprovalMock).toHaveBeenCalledWith("contest", 42, "publish", "Publish the selected SAT contest.");
  });

  it("uses the selected contest lesson's stored questions", async () => {
    const selectedContest = { id: 7, lessonId: 19, title: "Algebra Sprint" };
    listQuestionsForLessonMock.mockResolvedValue([{ id: 901, lessonId: selectedContest.lessonId, prompt: "Stored question" }]);
    const result = await appRouter.createCaller(context).academy.lessonQuestions({ lessonId: selectedContest.lessonId });
    expect(result).toEqual([{ id: 901, lessonId: 19, prompt: "Stored question" }]);
    expect(listQuestionsForLessonMock).toHaveBeenCalledWith(selectedContest.lessonId);
  });

  it("keeps the selected contest identity when saving a student attempt", async () => {
    saveContestAttemptMock.mockResolvedValue({ success: true });
    const result = await appRouter.createCaller(context).academy.saveContest({ contestId: 7, title: "Algebra Sprint", score: 3, total: 4, durationSeconds: 110 });
    expect(result).toEqual({ success: true });
    expect(saveContestAttemptMock).toHaveBeenCalledWith({ userId: 1, contestId: 7, title: "Algebra Sprint", score: 3, total: 4, durationSeconds: 110 });
  });
});
