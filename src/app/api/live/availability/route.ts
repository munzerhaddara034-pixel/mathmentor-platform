import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { getAvailability, setAvailability } from "@/lib/live/store";
import type { TeacherAvailability } from "@/lib/live/types";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const availability = await getAvailability();
  return NextResponse.json({ availability });
}

export async function PUT(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as Partial<TeacherAvailability>;
  const store = await setAvailability(body);
  return NextResponse.json({ ok: true, availability: store.availability, slotCount: store.slots.length });
}
