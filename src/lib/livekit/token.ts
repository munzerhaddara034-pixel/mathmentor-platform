import { AccessToken, type VideoGrant } from "livekit-server-sdk";
import { INSTRUCTOR_LINE } from "@/lib/pedagogy/lebanese";
import { livekitEnv, LIVEKIT_TOKEN_TTL } from "./config";
import { studentVideoGrants, teacherVideoGrants } from "./grants";
import type { ClassroomGrants, ClassroomTokenPayload } from "./protocol";

function asVideoGrant(grants: ClassroomGrants): VideoGrant {
  return {
    room: grants.room,
    roomJoin: grants.roomJoin,
    roomCreate: grants.roomCreate,
    roomAdmin: grants.roomAdmin,
    canPublish: grants.canPublish,
    canSubscribe: grants.canSubscribe,
    canPublishData: grants.canPublishData,
    canUpdateOwnMetadata: grants.canUpdateOwnMetadata,
  };
}

export async function mintClassroomToken(input: {
  identity: string;
  name: string;
  roomName: string;
  isTeacher: boolean;
  canWriteBoard: boolean;
  canPublishAv: boolean;
}): Promise<ClassroomTokenPayload> {
  const env = livekitEnv();
  const grants = input.isTeacher
    ? teacherVideoGrants(input.roomName)
    : studentVideoGrants(input.roomName, input.canPublishAv);

  const base: ClassroomTokenPayload = {
    ok: false,
    demo: !env.configured,
    token: null,
    serverUrl: env.publicUrl || null,
    roomName: input.roomName,
    identity: input.identity,
    name: input.name,
    isTeacher: input.isTeacher,
    canWriteBoard: input.isTeacher || input.canWriteBoard,
    canPublishAv: input.isTeacher || input.canPublishAv,
    grants,
    docs: "/docs/LIVEKIT.md",
  };

  if (!env.configured) {
    return {
      ...base,
      error:
        "LiveKit Cloud is not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET). The classroom UI is running in mock/shell mode.",
      errorAr:
        "لم تُضبط مفاتيح LiveKit Cloud. الصف يعمل في وضع تجريبي (الواجهة فقط بدون اتصال فيديو).",
    };
  }

  const at = new AccessToken(env.apiKey, env.apiSecret, {
    identity: input.identity,
    name: input.name,
    ttl: LIVEKIT_TOKEN_TTL,
    metadata: JSON.stringify({
      role: input.isTeacher ? "teacher" : "student",
      canWriteBoard: input.isTeacher || input.canWriteBoard,
      instructor: INSTRUCTOR_LINE,
    }),
  });
  at.addGrant(asVideoGrant(grants));
  const token = await at.toJwt();
  return {
    ...base,
    ok: true,
    demo: false,
    token,
    serverUrl: env.publicUrl || env.url,
  };
}
