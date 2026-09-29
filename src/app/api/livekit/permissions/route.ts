import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { livekitEnv, livekitHttpUrl } from "@/lib/livekit/config";
import { sanitizeRoomName } from "@/lib/livekit/rooms";
import { getClassroomRoom, patchClassroomRoom, toggleId } from "@/lib/livekit/store";

export const runtime = "nodejs";

async function applyLivekitPermission(room: string, identity: string, canPublish: boolean) {
  const env = livekitEnv();
  if (!env.configured) return { applied: false as const };
  const svc = new RoomServiceClient(livekitHttpUrl(env.url), env.apiKey, env.apiSecret);
  await svc.updateParticipant(room, identity, {
    permission: {
      canPublish,
      canSubscribe: true,
      canPublishData: true,
      canUpdateMetadata: true,
    },
  });
  return { applied: true as const };
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!isStaffRole(guard.live.user.role)) {
    return NextResponse.json(
      { error: "Teacher or admin only.", errorAr: "للأستاذ أو الإدارة فقط." },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    room?: string;
    identity?: string;
    canPublishAv?: boolean;
    canWriteBoard?: boolean;
  };
  const room = sanitizeRoomName(body.room || "");
  const identity = body.identity?.trim();
  if (!identity) {
    return NextResponse.json({ error: "identity required." }, { status: 400 });
  }

  const current = await getClassroomRoom(room);
  const next = await patchClassroomRoom(room, {
    writers:
      typeof body.canWriteBoard === "boolean"
        ? toggleId(current.writers, identity, body.canWriteBoard)
        : current.writers,
    avAllowed:
      typeof body.canPublishAv === "boolean"
        ? toggleId(current.avAllowed, identity, body.canPublishAv)
        : current.avAllowed,
  });

  let livekit = { applied: false as boolean | "skipped" };
  if (typeof body.canPublishAv === "boolean") {
    try {
      const result = await applyLivekitPermission(room, identity, body.canPublishAv);
      livekit = { applied: result.applied };
    } catch (error) {
      const message = error instanceof Error ? error.message : "LiveKit updateParticipant failed.";
      return NextResponse.json(
        {
          ok: true,
          room: next,
          livekitError: message,
          demo: !livekitEnv().configured,
        },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    room: next,
    livekit,
    demo: !livekitEnv().configured,
  });
}
