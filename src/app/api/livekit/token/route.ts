import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { livekitEnv } from "@/lib/livekit/config";
import { assertClassroomAccess, sanitizeRoomName } from "@/lib/livekit/rooms";
import { getClassroomRoom } from "@/lib/livekit/store";
import { mintClassroomToken } from "@/lib/livekit/token";

export const runtime = "nodejs";

type TokenBody = {
  identity?: string;
  isTeacher?: boolean;
  room?: string;
  roomName?: string;
  sessionId?: string;
};

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;

  let body: TokenBody = {};
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    body = {};
  }

  const roomName = sanitizeRoomName(body.room || body.roomName || body.sessionId || "");
  const staff = isStaffRole(user.role);
  if (body.isTeacher === true && !staff) {
    return NextResponse.json(
      {
        ok: false,
        demo: !livekitEnv().configured,
        error: "Teacher tokens require a teacher or admin account.",
        errorAr: "رمز الأستاذ يتطلب حساب أستاذ أو إدارة.",
      },
      { status: 403 },
    );
  }
  const wantTeacher = staff && body.isTeacher !== false;

  const access = await assertClassroomAccess(user, roomName, wantTeacher);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, demo: !livekitEnv().configured, error: access.error, errorAr: access.errorAr },
      { status: access.status },
    );
  }

  const room = await getClassroomRoom(roomName);
  if (room.ended && !access.isTeacher) {
    return NextResponse.json(
      {
        ok: false,
        demo: false,
        error: "This class has ended.",
        errorAr: "انتهت هذه الحصة.",
      },
      { status: 410 },
    );
  }

  const displayName = body.identity?.trim() || user.name;
  const payload = await mintClassroomToken({
    identity: user.id,
    name: displayName,
    roomName,
    isTeacher: access.isTeacher,
    canWriteBoard: room.writers.includes(user.id),
    canPublishAv: room.avAllowed.includes(user.id),
  });

  return NextResponse.json(payload, { status: 200 });
}
