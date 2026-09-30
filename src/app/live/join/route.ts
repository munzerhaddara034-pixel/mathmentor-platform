import { NextResponse } from "next/server";
import { bookingAllowsJoin, bookingRoomName } from "@/lib/livekit/accessRules";
import { liveJoinSecret, LIVE_GUEST_COOKIE, verifyJoinToken } from "@/lib/livekit/joinToken";
import { classroomPath } from "@/lib/livekit/roomNames";
import { getBooking } from "@/lib/live/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Guest entry: /live/join?t=<signed token> → sets an httpOnly guest cookie scoped to the
 * booking and redirects to its classroom. Invalid/expired/unpaid → /live?join=<reason>.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/live?join=${reason}`, url.origin));
  try {
    const token = url.searchParams.get("t") || "";
    const verified = verifyJoinToken(token, liveJoinSecret());
    if (!verified.ok) return fail(verified.reason === "expired" ? "expired" : "invalid");
    const booking = await getBooking(verified.bookingId);
    if (!booking || booking.studentId !== verified.studentId) return fail("invalid");
    const check = bookingAllowsJoin(booking);
    if (!check.ok) return fail(check.reason === "pending_payment" ? "pending" : "invalid");

    const response = NextResponse.redirect(new URL(classroomPath(bookingRoomName(booking)), url.origin));
    response.cookies.set(LIVE_GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: url.protocol === "https:",
      path: "/",
      expires: new Date(verified.expiresAt),
    });
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  } catch (error) {
    console.error("[mathmentor] guest join failed", error instanceof Error ? error.message : error);
    return fail("error");
  }
}
