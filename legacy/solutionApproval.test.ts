import { beforeEach, describe, expect, it, vi } from "vitest";

const { reviewSolutionAssetsMock } = vi.hoisted(() => ({
  reviewSolutionAssetsMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    reviewSolutionAssets: reviewSolutionAssetsMock,
  };
});

import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(role: "admin" | "user", id: number): TrpcContext {
  return { user: { id, role }, req: {}, res: {} } as unknown as TrpcContext;
}

describe("bulk solution approval", () => {
  beforeEach(() => {
    reviewSolutionAssetsMock.mockReset();
    reviewSolutionAssetsMock.mockImplementation(async (ids: number[], _professorId: number, status: "approved" | "rejected") => ({
      success: true,
      requestedCount: ids.length,
      status,
    }));
  });

  it("blocks non-professor users", async () => {
    await expect(
      appRouter.createCaller(context("user", 19)).academy.reviewSolutionDrafts({
        ids: [4, 8],
        status: "approved",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(reviewSolutionAssetsMock).not.toHaveBeenCalled();
  });

  it("passes the selected IDs, professor ID, and decision to the database layer", async () => {
    const result = await appRouter.createCaller(context("admin", 7)).academy.reviewSolutionDrafts({
      ids: [4, 8, 12],
      status: "rejected",
      professorNote: "These drafts require replacement.",
    });

    expect(reviewSolutionAssetsMock).toHaveBeenCalledWith(
      [4, 8, 12],
      7,
      "rejected",
      "These drafts require replacement.",
    );
    expect(result).toEqual({ success: true, requestedCount: 3, status: "rejected" });
  });

  it("rejects empty selections and unsupported bulk statuses", async () => {
    const caller = appRouter.createCaller(context("admin", 7));
    await expect(caller.academy.reviewSolutionDrafts({ ids: [], status: "approved" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.academy.reviewSolutionDrafts({ ids: [1], status: "changes_requested" as "approved" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reviewSolutionAssetsMock).not.toHaveBeenCalled();
  });
});
