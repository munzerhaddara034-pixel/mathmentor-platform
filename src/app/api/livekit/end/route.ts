import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { livekitEnv, livekitHttpUrl } from "@/lib/livekit/config";
import { sanitizeRoomName } from "@/lib/livekit/rooms";
import { patchClassroomRoom } from "@/lib/livekit/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json(
      { error: "Teacher or admin only.", errorAr: "للأستاذ أو الإدارة فقط." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as { room?: string };
  const room = sanitizeRoomName(body.room || "");
  await patchClassroomRoom(room, { ended: true });

  const env = livekitEnv();
  if (env.configured) {
    try {
      const svc = new RoomServiceClient(livekitHttpUrl(env.url), env.apiKey, env.apiSecret);
      await svc.deleteRoom(room);
    } catch (error) {
      const message = error instanceof Error ? error.message : "deleteRoom failed.";
      return NextResponse.json({
        ok: true,
        ended: true,
        demo: false,
        livekitError: message,
      });
    }
  }

  return NextResponse.json({ ok: true, ended: true, demo: !env.configured });
}
