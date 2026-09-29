import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { adjustLiveCredits } from "@/lib/auth/store";
import { listBookings, patchBooking } from "@/lib/live/store";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/live/types";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const bookings = await listBookings();
  return NextResponse.json({ bookings });
}

export async function PATCH(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as {
    id?: string;
    status?: BookingStatus;
    meetingLink?: string;
    teacherNote?: string;
  };
  if (!body.id) return NextResponse.json({ error: "id required." }, { status: 400 });
  if (body.status && !BOOKING_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const existing = (await listBookings()).find((item) => item.id === body.id);
  const booking = await patchBooking(body.id, {
    status: body.status,
    meetingLink: body.meetingLink,
    teacherNote: body.teacherNote,
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (existing && existing.status !== "cancelled" && booking.status === "cancelled") {
    await adjustLiveCredits(booking.studentId, 1);
  }
  return NextResponse.json({ booking });
}
