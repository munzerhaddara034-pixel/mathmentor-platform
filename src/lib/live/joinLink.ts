/**
 * Absolute classroom links for WhatsApp / notifications.
 * - Account holders get `<origin>/live/classroom/<room>` (login required).
 * - Guests (no account) get a signed, expiring `<origin>/live/join?t=…` for their own booking,
 *   but only once the booking is confirmed and paid.
 */
import { bookingAllowsJoin, bookingRoomName } from "@/lib/livekit/accessRules";
import { joinExpiryFor, liveJoinSecret, signJoinToken } from "@/lib/livekit/joinToken";
import { classroomPath, isGuestStudentId } from "@/lib/livekit/roomNames";
import type { LiveBooking } from "./types";

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
}

export function absoluteUrl(path: string): string {
  const origin = appOrigin();
  return origin ? `${origin}${path}` : path;
}

export function bookingClassroomUrl(booking: Pick<LiveBooking, "id" | "classroomRoomId">): string {
  return absoluteUrl(classroomPath(bookingRoomName(booking)));
}

export type GuestJoinLink = { url: string; expiresAt: number } | null;

/** Signed guest link, or null when not a guest booking / not paid / no server secret. */
export function guestJoinLink(booking: LiveBooking, now = Date.now()): GuestJoinLink {
  if (!isGuestStudentId(booking.studentId)) return null;
  if (!bookingAllowsJoin(booking).ok) return null;
  const secret = liveJoinSecret();
  if (!secret) return null;
  const expiresAt = joinExpiryFor(booking);
  if (expiresAt <= now) return null;
  const token = signJoinToken({ bookingId: booking.id, studentId: booking.studentId, expiresAt }, secret);
  return { url: absoluteUrl(`/live/join?t=${encodeURIComponent(token)}`), expiresAt };
}

/** Link the student should tap: signed guest link for guests, classroom URL otherwise. */
export function studentJoinUrl(booking: LiveBooking): string {
  return guestJoinLink(booking)?.url ?? bookingClassroomUrl(booking);
}
