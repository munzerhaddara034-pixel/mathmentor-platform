import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isPrivatePath, isPublicPath, loginUrl } from "@/lib/auth/paths";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || !isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const next = `${pathname}${request.nextUrl.search}`;
    const redirect = NextResponse.redirect(new URL(loginUrl(next), request.url));
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return redirect;
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
