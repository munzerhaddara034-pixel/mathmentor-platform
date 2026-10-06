/** Cookie holding the opaque session token. */
export const SESSION_COOKIE = "mm_session";

export type AuthRole = "student" | "teacher" | "parent" | "admin";

export const STAFF_ROLES: AuthRole[] = ["teacher", "admin"];

export function isStaffRole(role: AuthRole | string | undefined) {
  return role === "teacher" || role === "admin";
}

/** Teacher/admin accounts keep concurrent sessions; students still get same-class replacement. */
export function isSessionSharingExempt(user?: { role?: string; email?: string } | null) {
  if (!user) return false;
  return isStaffRole(user.role);
}

/** Marketing / auth surfaces — no login required. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/subscribe",
  "/live",
  /** Guest solver trial: a visitor may solve a few problems per day without an account. */
  "/math-solver",
  /** Legal pages: reachable and indexable for visitors, payment providers and app stores. */
  "/privacy",
  "/terms",
];

const PUBLIC_PREFIXES = [
  "/_next",
  "/favicon",
  "/brand/",
  "/manifest.webmanifest",
  "/sw.js",
  "/teachers/",
  "/classroom/students",
  "/studio/demo-avatar",
  "/videos/",
  /** Shareable solver result (random id); the page watermarks guest views and shows a sign-up banner. */
  "/math-solver/result",
];

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
  "/math-solver",
  "/live",
  "/exams",
  "/wallet",
  "/profile",
  "/settings",
  "/teacher",
];

const STAFF_PREFIXES = [
  "/studio/script",
  "/studio/voice-solver",
  "/teacher",
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
  if (path.startsWith("/api/bot")) return true; // route enforces its own auth (AI access)
  if (path === "/api/health") return true;
  if (path.startsWith("/api/whish/")) return true;
  if (path === "/api/live/slots" || path === "/api/live/book") return true;
  // Guest join links (signed, verified in the route) and the classroom API (own guard).
  if (path === "/live/join") return true;
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
