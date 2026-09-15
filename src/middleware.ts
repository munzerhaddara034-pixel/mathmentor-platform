import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { readSessionFromCookieValue, SESSION_COOKIE } from "@/lib/auth/session";

const AUTH_PREFIXES = ["/dashboard", "/profile", "/student"];
const TEACHER_PREFIXES = ["/professor", "/assistant", "/admin"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await readSessionFromCookieValue(token) : null;

  if ((pathname === "/login" || pathname === "/signup") && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const needsTeacher = matches(pathname, TEACHER_PREFIXES);
  const needsAuth = needsTeacher || matches(pathname, AUTH_PREFIXES);

  if (needsAuth && !session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (needsTeacher && session?.role !== "teacher") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/student",
    "/student/:path*",
    "/professor",
    "/professor/:path*",
    "/assistant",
    "/assistant/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    "/signup",
  ],
};
