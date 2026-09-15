import { describe, expect, it } from "vitest";
import { togglePageSelection, toggleSelectedId, toggleSelectAll } from "./bulkSelection";

describe("bulk lesson attempt selection", () => {
  it("toggles one attempt without duplicating ids", () => {
    expect(toggleSelectedId([], 4)).toEqual([4]);
    expect(toggleSelectedId([4, 8], 4)).toEqual([8]);
    expect(toggleSelectedId([4], 4)).toEqual([]);
  });

  it("selects all available attempts and clears when all are selected", () => {
    expect(toggleSelectAll([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(toggleSelectAll([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it("does not select an empty list", () => {
    expect(toggleSelectAll([], [])).toEqual([]);
  });

  it("selects the current page without losing selections from other pages", () => {
    expect(togglePageSelection([1], [2, 3])).toEqual([1, 2, 3]);
  });

  it("clears only the current page when every page item is selected", () => {
    expect(togglePageSelection([1, 2, 3, 8], [1, 2, 3])).toEqual([8]);
  });

  it("keeps the selection unchanged for an empty page", () => {
    expect(togglePageSelection([4], [])).toEqual([4]);
  });
});
