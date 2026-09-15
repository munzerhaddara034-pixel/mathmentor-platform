import { describe, expect, it } from "vitest";
import { filterParentLinks, paginateParentLinks } from "../shared/parentLinks";

const links = [
  { inviteEmail: "rana@example.com", studentId: 19, status: "pending" as const },
  { inviteEmail: "omar@example.com", studentId: 24, status: "accepted" as const },
  { inviteEmail: "lina@example.com", studentId: 31, status: "revoked" as const },
];

describe("parent invitation filters", () => {
  it("searches by email or student identifier without changing source data", () => {
    expect(filterParentLinks(links, "RANA", "all")).toEqual([links[0]]);
    expect(filterParentLinks(links, "24", "all")).toEqual([links[1]]);
    expect(links).toHaveLength(3);
  });

  it("filters by status and combines status with search", () => {
    expect(filterParentLinks(links, "", "accepted")).toEqual([links[1]]);
    expect(filterParentLinks(links, "example.com", "revoked")).toEqual([links[2]]);
    expect(filterParentLinks(links, "unknown", "all")).toEqual([]);
  });

  it("returns the requested page and clamps page boundaries", () => {
    const records = Array.from({ length: 11 }, (_, index) => ({ id: index + 1 }));
    expect(paginateParentLinks(records, 2, 5)).toEqual({ items: records.slice(5, 10), page: 2, pageCount: 3, total: 11 });
    expect(paginateParentLinks(records, 99, 5)).toEqual({ items: [records[10]], page: 3, pageCount: 3, total: 11 });
    expect(paginateParentLinks([], 0, 5)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});
