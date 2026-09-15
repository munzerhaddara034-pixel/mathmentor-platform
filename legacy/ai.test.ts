import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeLLMMock } = vi.hoisted(() => ({ invokeLLMMock: vi.fn() }));
vi.mock("./_core/llm", () => ({ invokeLLM: invokeLLMMock }));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("AI assistant procedures", () => {
  beforeEach(() => {
    invokeLLMMock.mockResolvedValue({ choices: [{ message: { content: "A clear step-by-step response." } }] });
  });

  it("returns a tutor explanation", async () => {
    const result = await appRouter.createCaller(createPublicContext()).ai.tutor({ messages: [{ role: "user", content: "Solve 3x + 5 = 20" }] });
    expect(result).toBe("A clear step-by-step response.");
    expect(invokeLLMMock).toHaveBeenCalled();
  });

  it("returns management guidance", async () => {
    const result = await appRouter.createCaller(createPublicContext()).ai.management({ summary: "Algebra accuracy is 72%; geometry accuracy is 38%." });
    expect(result).toContain("step-by-step");
  });

  it("creates an approval-gated operations proposal for a certificate track", async () => {
    invokeLLMMock.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ title: "Grade 9 certificate plan", summary: "Confirm class duration and included support before choosing a price.", suggestedAmount: 40, currency: "USD", suggestedBudget: 20, campaignChannel: "Instagram", campaignCopy: "Build confidence for the Grade 9 Certificate with focused English mathematics practice.", questionForProfessor: "Which monthly amount fits your teaching plan?" }) } }] });
    const context = { user: { id: 1, role: "admin" }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } as TrpcContext;
    const result = await appRouter.createCaller(context).ai.operationsDraft({ proposalType: "pricing", audience: "grade9", context: "Monthly certificate preparation." });
    expect(result).toContain("Grade 9 certificate plan");
    expect(invokeLLMMock.mock.calls.at(-1)?.[0].messages[0].content).toContain("never execute it");
    expect(invokeLLMMock.mock.calls.at(-1)?.[0].messages[0].content).toContain("Grades 9 and 12 and SAT Math");
  });

  it("keeps payment review cautious", async () => {
    const result = await appRouter.createCaller(createPublicContext()).ai.paymentReview({ submission: "Student says a Whish Money transfer was sent." });
    expect(result).toContain("step-by-step");
    expect(invokeLLMMock.mock.calls.at(-1)?.[0].messages[0].content).toContain("Professor approval");
  });
});
