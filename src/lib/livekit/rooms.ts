import { isStaffRole } from "@/lib/auth/paths";
import { userHasLiveAccess, type PublicUser } from "@/lib/auth/store";
import { listBookings } from "@/lib/live/store";

const ROOM_RE = /[^a-zA-Z0-9_-]+/g;

export function sanitizeRoomName(raw: string) {
  const cleaned = raw.trim().replace(ROOM_RE, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned.slice(0, 64) || "demo";
}

export function isDemoRoom(roomName: string) {
  const n = sanitizeRoomName(roomName).toLowerCase();
  return n === "demo" || n.startsWith("demo-") || n === "practice";
}

export function classroomPath(roomId: string) {
  return `/live/classroom/${encodeURIComponent(sanitizeRoomName(roomId))}`;
}

export type ClassroomAccess =
  | { ok: true; isTeacher: boolean }
  | { ok: false; status: number; error: string; errorAr: string };

export async function assertClassroomAccess(
  user: PublicUser,
  roomName: string,
  wantTeacher: boolean,
): Promise<ClassroomAccess> {
  const staff = isStaffRole(user.role);
  if (wantTeacher && !staff) {
    return {
      ok: false,
      status: 403,
      error: "Teacher tokens require a teacher or admin account.",
      errorAr: "رمز الأستاذ يتطلب حساب أستاذ أو إدارة.",
    };
  }
  if (staff) {
    return { ok: true, isTeacher: wantTeacher };
  }

  const liveOk = await userHasLiveAccess(user);
  if (!liveOk) {
    return {
      ok: false,
      status: 403,
      error: "LIVE_TIER or BOTH required to join a live classroom.",
      errorAr: "يلزم اشتراك الحصص المباشرة للدخول إلى الصف.",
    };
  }

  if (isDemoRoom(roomName)) {
    return { ok: true, isTeacher: false };
  }

  const bookings = await listBookings({ studentId: user.id });
  const match = bookings.find(
    (booking) => sanitizeRoomName(booking.id) === roomName && booking.status !== "cancelled",
  );
  if (!match) {
    return {
      ok: false,
      status: 403,
      error: "No live booking for this classroom. Book a slot or open the demo room.",
      errorAr: "لا يوجد حجز لهذه الحصة. احجز موعداً أو افتح الصف التجريبي.",
    };
  }
  return { ok: true, isTeacher: false };
}
