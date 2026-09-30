import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { livekitEnv, livekitHttpUrl } from "@/lib/livekit/config";
import { sanitizeRoomName } from "@/lib/livekit/rooms";
import { grantInRoom } from "@/lib/livekit/store";

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

  let body: { room?: string; identity?: string; canPublishAv?: boolean; canWriteBoard?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON.", errorAr: "طلب غير صالح." }, { status: 400 });
  }
  const room = sanitizeRoomName(body.room || "");
  const identity = body.identity?.trim();
  if (!identity) {
    return NextResponse.json({ error: "identity required.", errorAr: "المعرّف مطلوب." }, { status: 400 });
  }

  try {
    const next = await grantInRoom(room, {
      identity,
      canWriteBoard: typeof body.canWriteBoard === "boolean" ? body.canWriteBoard : undefined,
      canPublishAv: typeof body.canPublishAv === "boolean" ? body.canPublishAv : undefined,
    });
    let livekit: { applied: boolean; error?: string } = { applied: false };
    if (typeof body.canPublishAv === "boolean") {
      try {
        livekit = await applyLivekitPermission(room, identity, body.canPublishAv);
      } catch (error) {
        // Participant may not be connected yet: the stored grant applies on their next token.
        livekit = { applied: false, error: error instanceof Error ? error.message : "updateParticipant failed." };
      }
    }
    return NextResponse.json({
      ok: true,
      writers: next.writers,
      avAllowed: next.avAllowed,
      version: next.version,
      livekit,
      demo: !livekitEnv().configured,
    });
  } catch (error) {
    console.error("[mathmentor] classroom grant failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not save the permission.", errorAr: "تعذّر حفظ الصلاحية." }, { status: 503 });
  }
}
