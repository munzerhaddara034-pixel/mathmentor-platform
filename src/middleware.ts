import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, isPrivatePath, isPublicPath, loginUrl } from "@/lib/auth/paths";

/** Must match LIVE_GUEST_COOKIE in src/lib/livekit/joinToken.ts (edge runtime: no node:crypto import here). */
const LIVE_GUEST_COOKIE = "mm_live_guest";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname) || !isPrivatePath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Guests with a signed booking link: the classroom page/API verify the HMAC server-side.
  const guestClassroom = pathname.startsWith("/live/classroom/") && Boolean(request.cookies.get(LIVE_GUEST_COOKIE)?.value);
  if (!token && !guestClassroom) {
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
