export type ParentLinkStatus = "pending" | "accepted" | "revoked" | "expired";

export type ParentLinkSearchItem = {
  inviteEmail: string;
  studentId: number;
  status: ParentLinkStatus;
};

export function filterParentLinks<T extends ParentLinkSearchItem>(links: T[], search: string, status: ParentLinkStatus | "all") {
  const query = search.trim().toLowerCase();
  return links.filter((link) => {
    const matchesStatus = status === "all" || link.status === status;
    const matchesSearch = !query || link.inviteEmail.toLowerCase().includes(query) || String(link.studentId).includes(query);
    return matchesStatus && matchesSearch;
  });
}

export function paginateParentLinks<T>(links: T[], requestedPage: number, pageSize: number) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(links.length / safePageSize));
  const page = Math.min(Math.max(1, Math.floor(requestedPage)), pageCount);
  return {
    items: links.slice((page - 1) * safePageSize, page * safePageSize),
    page,
    pageCount,
    total: links.length,
  };
}
