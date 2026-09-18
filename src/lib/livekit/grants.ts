import type { ClassroomGrants } from "./protocol";

/** Teacher / admin: publish AV + data (whiteboard control), subscribe, room admin. */
export function teacherVideoGrants(room: string): ClassroomGrants {
  return {
    room,
    roomJoin: true,
    roomCreate: true,
    roomAdmin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  };
}

/**
 * Students: subscribe always. Data publish stays on so they can raise a hand and chat.
 * AV publish is off until the teacher grants it. Whiteboard write is an app-level
 * permission (data message / room store), not a video grant.
 */
export function studentVideoGrants(room: string, canPublishAv = false): ClassroomGrants {
  return {
    room,
    roomJoin: true,
    roomCreate: false,
    roomAdmin: false,
    canPublish: canPublishAv,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  };
}
