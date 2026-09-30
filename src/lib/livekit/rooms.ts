import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/auth/paths";
import { getLiveSession } from "@/lib/auth/session";
import { userHasLiveAccess, type PublicUser } from "@/lib/auth/store";
import { getBooking, listBookings } from "@/lib/live/store";
import { decideClassroomAccess, decideGuestAccess, type ClassroomAccess } from "./accessRules";
import { liveJoinSecret, LIVE_GUEST_COOKIE, verifyJoinToken } from "./joinToken";

export { classroomPath, isDemoRoom, sanitizeRoomName } from "./roomNames";
export type { ClassroomAccess } from "./accessRules";

/** Who is asking for the classroom: a signed-in account or a guest with a signed link. */
export type ClassroomActor =
  | { kind: "user"; identity: string; name: string; staff: boolean; user: PublicUser }
  | { kind: "guest"; identity: string; name: string; staff: false; bookingId: string };

export async function assertClassroomAccess(user: PublicUser, roomName: string, wantTeacher: boolean): Promise<ClassroomAccess> {
  const staff = isStaffRole(user.role);
  if (staff || wantTeacher) {
    return decideClassroomAccess({ staff, wantTeacher, liveTier: staff, roomName, userId: user.id, bookings: [] });
  }
  const [liveTier, bookings] = await Promise.all([userHasLiveAccess(user), listBookings({ studentId: user.id })]);
  return decideClassroomAccess({ staff, wantTeacher, liveTier, roomName, userId: user.id, bookings });
}

async function guestFromCookie(): Promise<Extract<ClassroomActor, { kind: "guest" }> | null> {
  const jar = await cookies();
  const token = jar.get(LIVE_GUEST_COOKIE)?.value;
  if (!token) return null;
  const verified = verifyJoinToken(token, liveJoinSecret());
  if (!verified.ok) return null;
  const booking = await getBooking(verified.bookingId);
  if (!booking || booking.studentId !== verified.studentId) return null;
  return { kind: "guest", identity: booking.studentId, name: booking.studentName || "ضيف", staff: false, bookingId: booking.id };
}

/** Session user first, then a valid guest cookie; `null` when neither. */
export async function resolveClassroomActor(): Promise<ClassroomActor | null> {
  const live = await getLiveSession();
  if (live.ok) {
    return { kind: "user", identity: live.user.id, name: live.user.name, staff: isStaffRole(live.user.role), user: live.user };
  }
  return guestFromCookie();
}

export async function authorizeActor(actor: ClassroomActor, roomName: string, wantTeacher: boolean): Promise<ClassroomAccess> {
  if (actor.kind === "user") return assertClassroomAccess(actor.user, roomName, wantTeacher);
  if (wantTeacher) {
    return { ok: false, status: 403, error: "Teacher tokens require a teacher or admin account.", errorAr: "رمز الأستاذ يتطلب حساب أستاذ أو إدارة." };
  }
  const booking = await getBooking(actor.bookingId);
  return decideGuestAccess({ roomName, tokenBookingId: actor.bookingId, tokenStudentId: actor.identity, booking: booking ?? null });
}

/** API helper: actor + access, or a ready JSON error response. */
export async function classroomGuard(
  roomName: string,
  wantTeacher: (actor: ClassroomActor) => boolean,
): Promise<{ actor: ClassroomActor; access: Extract<ClassroomAccess, { ok: true }>; error: null } | { error: NextResponse }> {
  try {
    const actor = await resolveClassroomActor();
    if (!actor) {
      return {
        error: NextResponse.json(
          { ok: false, reason: "unauthenticated", error: "Sign in required.", errorAr: "يلزم تسجيل الدخول." },
          { status: 401 },
        ),
      };
    }
    const access = await authorizeActor(actor, roomName, wantTeacher(actor));
    if (!access.ok) {
      return { error: NextResponse.json({ ok: false, error: access.error, errorAr: access.errorAr }, { status: access.status }) };
    }
    return { actor, access, error: null };
  } catch (error) {
    console.error("[mathmentor] classroom guard failed", error instanceof Error ? error.message : error);
    return {
      error: NextResponse.json(
        { ok: false, error: "Classroom service unavailable.", errorAr: "خدمة الصف غير متاحة مؤقتاً. حاول مجدداً." },
        { status: 503 },
      ),
    };
  }
}
