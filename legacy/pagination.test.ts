import { describe, expect, it } from "vitest";
import { paginateItems } from "./pagination";

describe("paginateItems", () => {
  it("returns the requested page and total page count", () => {
    expect(paginateItems([1, 2, 3, 4, 5], 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      pageSize: 2,
      totalPages: 3,
    });
  });

  it("clamps pages outside the available range", () => {
    expect(paginateItems(["a", "b"], 9, 1).items).toEqual(["b"]);
    expect(paginateItems(["a", "b"], 0, 1).page).toBe(1);
  });

  it("uses a safe page size when the input is invalid", () => {
    expect(paginateItems(["a", "b"], 1, 0)).toEqual({
      items: ["a"],
      page: 1,
      pageSize: 1,
      totalPages: 2,
    });
  });
});
