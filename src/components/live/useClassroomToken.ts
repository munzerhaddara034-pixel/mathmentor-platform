"use client";

import { useCallback, useEffect, useState } from "react";
import type { ClassroomTokenPayload } from "@/lib/livekit/protocol";

export type ClassroomUser = { id: string; name: string; role: string };

type TokenApiResponse = Partial<ClassroomTokenPayload> & { error?: string; errorAr?: string };

export function emptySession(roomId: string, user: ClassroomUser, staff: boolean): ClassroomTokenPayload {
  return {
    ok: false,
    demo: true,
    token: null,
    serverUrl: null,
    roomName: roomId,
    identity: user.id,
    name: user.name,
    isTeacher: staff,
    canWriteBoard: staff,
    canPublishAv: staff,
    grants: {
      room: roomId,
      roomJoin: true,
      roomCreate: staff,
      roomAdmin: staff,
      canPublish: staff,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
  };
}

/** Fetches (and can re-fetch) the classroom token; the server reopens ended rooms for teachers. */
export function useClassroomToken(roomId: string, user: ClassroomUser, staff: boolean) {
  const [session, setSession] = useState<ClassroomTokenPayload>(() => emptySession(roomId, user, staff));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    const base = emptySession(roomId, user, staff);
    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ identity: user.name, isTeacher: staff, room: roomId }),
      });
      setStatus(response.status);
      const payload = (await response.json().catch(() => ({}))) as TokenApiResponse;
      if (response.ok && payload.roomName) {
        setSession({ ...base, ...payload, grants: payload.grants ?? base.grants } as ClassroomTokenPayload);
      } else {
        setSession({
          ...base,
          isTeacher: false,
          canWriteBoard: false,
          canPublishAv: false,
          error: payload.error ?? "Could not issue a classroom token.",
          errorAr: payload.errorAr ?? "تعذّر إصدار رمز الصف.",
        });
      }
    } catch {
      setStatus(0);
      setSession({ ...base, error: "Could not reach the classroom service.", errorAr: "تعذّر الوصول إلى خدمة الصف — تحقّق من الاتصال." });
    } finally {
      setLoading(false);
    }
  }, [roomId, staff, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = status >= 200 && status < 300;
  const live = Boolean(allowed && session.ok && session.token && session.serverUrl && !session.demo);
  return { session, loading, allowed, live, reload: load };
}
