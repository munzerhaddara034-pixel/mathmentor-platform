import { describe, expect, it, vi } from "vitest";

const { updateMock, setMock, whereMock, valuesMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  setMock: vi.fn(),
  whereMock: vi.fn(),
  valuesMock: vi.fn(),
}));

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => ({ insert: vi.fn(() => ({ values: valuesMock })), update: updateMock })) }));
vi.mock("drizzle-orm", () => ({ desc: vi.fn(), eq: vi.fn((column, value) => ({ column, value })) }));

import { applyApproval } from "./db";

describe("contest approval side effect", () => {
  it("publishes contest_contents for the selected contest ID", async () => {
    process.env.DATABASE_URL = "mysql://test";
    valuesMock.mockResolvedValue(undefined);
    whereMock.mockResolvedValue(undefined);
    setMock.mockReturnValue({ where: whereMock });
    updateMock.mockReturnValue({ set: setMock });

    await applyApproval("contest", 42, "publish", "Publish selected contest");

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith({ isPublished: 1 });
    expect(whereMock).toHaveBeenCalledWith(expect.objectContaining({ value: 42 }));
  });
});
