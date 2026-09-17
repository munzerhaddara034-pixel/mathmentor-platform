export function paginateItems<T>(items: T[], page: number, pageSize: number) {
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const totalPages = Math.max(1, Math.ceil(items.length / normalizedPageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * normalizedPageSize;

  return {
    items: items.slice(start, start + normalizedPageSize),
    page: safePage,
    pageSize: normalizedPageSize,
    totalPages,
  };
}
