/**
 * Classroom access decisions (pure — unit-tested in tests/liveClassroom.test.mjs).
 *
 * Rules:
 * - Teacher tokens need a staff account; staff may enter any room.
 * - A confirmed booking (paid, or created with no payment flow) owned by the user grants its
 *   room, with or without a LIVE subscription. `pending_payment` / failed payment never does.
 * - Demo/practice rooms need LIVE_TIER or BOTH.
 * - Guests (no account) enter only through a signed join link for their own booking.
 */
import { isDemoRoom, sanitizeRoomName } from "./roomNames.ts";

export type AccessBooking = {
  id: string;
  studentId: string;
  status: string;
  paymentStatus?: string;
  classroomRoomId?: string;
};

export type ClassroomAccess =
  | { ok: true; isTeacher: boolean; bookingId?: string }
  | { ok: false; status: number; error: string; errorAr: string };

export type BookingJoinCheck =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "pending_payment" | "unconfirmed" };

export function bookingRoomName(booking: Pick<AccessBooking, "id" | "classroomRoomId">) {
  return sanitizeRoomName(booking.classroomRoomId || booking.id);
}

export function bookingAllowsJoin(booking: Pick<AccessBooking, "status" | "paymentStatus">): BookingJoinCheck {
  if (booking.status === "cancelled") return { ok: false, reason: "cancelled" };
  const payment = booking.paymentStatus ?? "none";
  if (booking.status === "pending_payment" || payment === "pending" || payment === "failed") {
    return { ok: false, reason: "pending_payment" };
  }
  if (booking.status !== "confirmed" && booking.status !== "completed") {
    return { ok: false, reason: "unconfirmed" };
  }
  return payment === "paid" || payment === "none" ? { ok: true } : { ok: false, reason: "pending_payment" };
}

const DENY_TEACHER: ClassroomAccess = {
  ok: false,
  status: 403,
  error: "Teacher tokens require a teacher or admin account.",
  errorAr: "رمز الأستاذ يتطلب حساب أستاذ أو إدارة.",
};

function denyForBooking(check: Exclude<BookingJoinCheck, { ok: true }>): ClassroomAccess {
  if (check.reason === "pending_payment") {
    return {
      ok: false,
      status: 402,
      error: "Your booking is waiting for payment confirmation.",
      errorAr: "حجزك بانتظار تأكيد الدفع عبر Whish. يفتح الصف بعد تأكيد الأستاذ.",
    };
  }
  if (check.reason === "cancelled") {
    return { ok: false, status: 403, error: "This booking was cancelled.", errorAr: "تم إلغاء هذا الحجز." };
  }
  return { ok: false, status: 403, error: "This booking is not confirmed yet.", errorAr: "الحجز لم يُؤكَّد بعد." };
}

export function decideClassroomAccess(input: {
  staff: boolean;
  wantTeacher: boolean;
  liveTier: boolean;
  roomName: string;
  userId: string;
  bookings: AccessBooking[];
}): ClassroomAccess {
  if (input.wantTeacher && !input.staff) return DENY_TEACHER;
  if (input.staff) return { ok: true, isTeacher: input.wantTeacher };

  const room = sanitizeRoomName(input.roomName);
  const own = input.bookings.filter((booking) => booking.studentId === input.userId && bookingRoomName(booking) === room);
  const granted = own.find((booking) => bookingAllowsJoin(booking).ok);
  if (granted) return { ok: true, isTeacher: false, bookingId: granted.id };
  const blocking = own.find((booking) => booking.status !== "cancelled") ?? own[0];
  if (blocking) {
    const check = bookingAllowsJoin(blocking);
    if (!check.ok) return denyForBooking(check);
  }

  if (isDemoRoom(room)) {
    if (input.liveTier) return { ok: true, isTeacher: false };
    return {
      ok: false,
      status: 403,
      error: "The demo classroom needs a live subscription. Book a session to join your own room.",
      errorAr: "الصف التجريبي يتطلب اشتراك الحصص المباشرة. احجز حصة لتدخل صفّك الخاص.",
    };
  }
  return {
    ok: false,
    status: 403,
    error: "No confirmed booking for this classroom.",
    errorAr: "لا يوجد حجز مؤكَّد لهذه الحصة. احجز موعداً من صفحة الحصص المباشرة.",
  };
}

/** Guest link holder: the verified token must name this booking and its room. */
export function decideGuestAccess(input: {
  roomName: string;
  tokenBookingId: string;
  tokenStudentId: string;
  booking: AccessBooking | null;
}): ClassroomAccess {
  const booking = input.booking;
  if (!booking || booking.id !== input.tokenBookingId || booking.studentId !== input.tokenStudentId) {
    return { ok: false, status: 403, error: "Invalid join link.", errorAr: "رابط الدخول غير صالح." };
  }
  if (bookingRoomName(booking) !== sanitizeRoomName(input.roomName)) {
    return { ok: false, status: 403, error: "This link is for another classroom.", errorAr: "هذا الرابط لصف آخر." };
  }
  const check = bookingAllowsJoin(booking);
  if (!check.ok) return denyForBooking(check);
  return { ok: true, isTeacher: false, bookingId: booking.id };
}
