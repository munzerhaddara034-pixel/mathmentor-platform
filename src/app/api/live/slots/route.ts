import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasLiveAccess } from "@/lib/auth/store";
import { addSlot, availableSlots, getAvailability, listBookings, listSlots, removeSlot } from "@/lib/live/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const staff = isStaffRole(guard.live.user.role);
  const allowed = staff || (await userHasLiveAccess(guard.live.user));
  if (!allowed) {
    return NextResponse.json({ error: "LIVE_TIER or BOTH required.", errorAr: "يلزم اشتراك الحصص المباشرة." }, { status: 403 });
  }
  const credits = guard.live.user.liveCredits ?? 0;
  const slots = staff ? await listSlots() : credits > 0 ? await availableSlots() : [];
  const bookings = await listBookings(staff ? undefined : { studentId: guard.live.user.id });
  const availability = await getAvailability();
  return NextResponse.json({
    slots,
    bookings,
    availability,
    liveCredits: credits,
    timezone: availability.timezone,
  });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as { startsAt?: string; durationMinutes?: number; capacity?: number; note?: string };
  if (!body.startsAt) return NextResponse.json({ error: "startsAt required." }, { status: 400 });
  const slot = await addSlot({
    startsAt: body.startsAt,
    durationMinutes: body.durationMinutes,
    capacity: body.capacity,
    note: body.note,
  });
  return NextResponse.json({ slot });
}

export async function DELETE(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  await removeSlot(id);
  return NextResponse.json({ ok: true });
}
