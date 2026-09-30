import { NextResponse } from "next/server";
import { livekitEnv } from "@/lib/livekit/config";
import { classroomGuard, sanitizeRoomName } from "@/lib/livekit/rooms";
import { getClassroomRoom, reopenClassroomForTeacher } from "@/lib/livekit/store";
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
  let body: TokenBody = {};
  try {
    body = (await request.json()) as TokenBody;
  } catch {
    body = {};
  }

  const roomName = sanitizeRoomName(body.room || body.roomName || body.sessionId || "");
  const guard = await classroomGuard(roomName, (actor) => (body.isTeacher === true ? true : actor.staff && body.isTeacher !== false));
  if (guard.error) {
    return guard.error;
  }
  const { actor, access } = guard;

  try {
    // Teacher (re)joining reopens a room that was ended earlier («ابدأ من جديد»).
    const room = access.isTeacher ? await reopenClassroomForTeacher(roomName) : await getClassroomRoom(roomName);
    if (room.ended && !access.isTeacher) {
      return NextResponse.json(
        { ok: false, demo: !livekitEnv().configured, error: "This class has ended.", errorAr: "انتهت هذه الحصة. انتظر الأستاذ ليبدأ من جديد." },
        { status: 410 },
      );
    }

    const displayName = (actor.kind === "user" ? body.identity?.trim() : "") || actor.name;
    const payload = await mintClassroomToken({
      identity: actor.identity,
      name: displayName.slice(0, 80),
      roomName,
      isTeacher: access.isTeacher,
      canWriteBoard: room.writers.includes(actor.identity),
      canPublishAv: room.avAllowed.includes(actor.identity),
    });
    return NextResponse.json({ ...payload, guest: actor.kind === "guest" }, { status: 200 });
  } catch (error) {
    console.error("[mathmentor] livekit token failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { ok: false, demo: !livekitEnv().configured, error: "Could not issue a classroom token.", errorAr: "تعذّر إصدار رمز الصف. حاول مجدداً." },
      { status: 500 },
    );
  }
}
