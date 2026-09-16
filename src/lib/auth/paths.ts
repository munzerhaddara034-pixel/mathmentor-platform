/** Cookie holding the opaque session token. */
export const SESSION_COOKIE = "mm_session";

export type AuthRole = "student" | "teacher" | "parent" | "admin";

export const STAFF_ROLES: AuthRole[] = ["teacher", "admin"];

export function isStaffRole(role: AuthRole | string | undefined) {
  return role === "teacher" || role === "admin";
}

/** Marketing / auth surfaces — no login required. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/subscribe",
];

const PUBLIC_PREFIXES = ["/_next", "/favicon", "/teachers/", "/classroom/students", "/studio/demo-avatar"];

const PRIVATE_PREFIXES = [
  "/lessons",
  "/studio",
  "/classroom",
  "/practice",
  "/quiz",
  "/student",
  "/dashboard",
  "/professor",
  "/admin",
  "/assistant",
  "/bank",
  "/resources",
  "/leaderboard",
  "/redeem",
  "/activate",
];

const STAFF_PREFIXES = [
  "/studio/script",
  "/admin",
  "/professor",
  "/dashboard",
  "/assistant",
  "/bank",
];

export function normalizePath(pathname: string) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isPublicPath(pathname: string) {
  const path = normalizePath(pathname);
  if (PUBLIC_PATHS.includes(path)) return true;
  if (path.startsWith("/api/auth/")) return true;
  if (path.startsWith("/api/bot")) return true;
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (/\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|mp4|woff2?|txt|map)$/i.test(path)) return true;
  return false;
}

export function isPrivatePath(pathname: string) {
  const path = normalizePath(pathname);
  if (isPublicPath(path)) return false;
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isStaffPath(pathname: string) {
  const path = normalizePath(pathname);
  return STAFF_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function loginUrl(nextPath: string, reason?: string) {
  const params = new URLSearchParams();
  if (nextPath && nextPath !== "/login") params.set("next", nextPath);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}
