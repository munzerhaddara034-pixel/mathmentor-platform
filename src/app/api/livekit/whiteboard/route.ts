import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { livekitEnv } from "@/lib/livekit/config";
import { assertClassroomAccess, sanitizeRoomName } from "@/lib/livekit/rooms";
import { getClassroomRoom, patchClassroomRoom } from "@/lib/livekit/store";
import type { WhiteboardEquation, WhiteboardStroke } from "@/lib/livekit/protocol";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const room = sanitizeRoomName(new URL(request.url).searchParams.get("room") || "");
  const staff = isStaffRole(guard.live.user.role);
  const access = await assertClassroomAccess(guard.live.user, room, staff);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, errorAr: access.errorAr }, { status: access.status });
  }
  const state = await getClassroomRoom(room);
  return NextResponse.json({ ok: true, room, state, demo: !livekitEnv().configured });
}

export async function PUT(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const body = (await request.json()) as {
    room?: string;
    strokes?: WhiteboardStroke[];
    equations?: WhiteboardEquation[];
  };
  const room = sanitizeRoomName(body.room || "");
  const staff = isStaffRole(guard.live.user.role);
  const access = await assertClassroomAccess(guard.live.user, room, staff);
  if (!access.ok) {
    return NextResponse.json({ error: access.error, errorAr: access.errorAr }, { status: access.status });
  }
  const current = await getClassroomRoom(room);
  const canWrite = access.isTeacher || current.writers.includes(guard.live.user.id);
  if (!canWrite) {
    return NextResponse.json(
      { error: "Whiteboard write is not granted.", errorAr: "الكتابة على السبورة غير مسموحة." },
      { status: 403 },
    );
  }
  const state = await patchClassroomRoom(room, {
    strokes: Array.isArray(body.strokes) ? body.strokes.slice(-200) : current.strokes,
    equations: Array.isArray(body.equations) ? body.equations.slice(-80) : current.equations,
  });
  return NextResponse.json({ ok: true, state });
}
