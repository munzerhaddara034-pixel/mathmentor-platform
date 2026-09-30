/**
 * Teacher broadcast status for the teacher slot (home booking card + dashboard "next session").
 *
 * There is no cheap live-status source yet: LiveKit rooms are only known inside /live. Until one exists,
 * `getTeacherLiveStatus()` returns `offline` without any I/O, so the slot renders the photo fallback.
 *
 * To wire it up (see docs/redesign-v2-teacher-slot.md):
 *   1. LiveKit webhook (`room_started` / `participant_joined` / `room_finished`) → persist a single
 *      `teacher_live_status` row { roomId, title, viewers, startedAt, posterUrl }.
 *   2. Read that row here (server, cached a few seconds) so the first paint already has the right state.
 *   3. Expose it at `TEACHER_LIVE_STATUS_ENDPOINT` so `useTeacherLiveStatus` can poll while the tab is visible.
 * Never invent viewers or times: `null` means "unknown" and is simply not shown.
 */
export type TeacherLiveStatus =
  | { state: "offline" }
  | {
      state: "live";
      roomId: string;
      /** Where the red button goes (the live room). */
      roomHref: string;
      title: string | null;
      viewers: number | null;
      startedAt: string;
      /** Still frame for data-saver / before the visitor taps. */
      posterUrl: string | null;
    };

/** Poll path for the client hook; `null` = no endpoint yet (hook stays idle). */
export const TEACHER_LIVE_STATUS_ENDPOINT: string | null = null;

export const OFFLINE_STATUS: TeacherLiveStatus = { state: "offline" };

export async function getTeacherLiveStatus(): Promise<TeacherLiveStatus> {
  return OFFLINE_STATUS;
}

/** Narrow unknown JSON (from the future endpoint) into a status; anything malformed → offline. */
export function parseTeacherLiveStatus(value: unknown): TeacherLiveStatus {
  if (!value || typeof value !== "object") return OFFLINE_STATUS;
  const record = value as Record<string, unknown>;
  if (record.state !== "live" || typeof record.roomId !== "string" || typeof record.startedAt !== "string") return OFFLINE_STATUS;
  return {
    state: "live",
    roomId: record.roomId,
    roomHref: typeof record.roomHref === "string" && record.roomHref.startsWith("/") ? record.roomHref : "/live",
    title: typeof record.title === "string" ? record.title : null,
    viewers: typeof record.viewers === "number" && Number.isFinite(record.viewers) ? Math.max(0, Math.round(record.viewers)) : null,
    startedAt: record.startedAt,
    posterUrl: typeof record.posterUrl === "string" && record.posterUrl.startsWith("/") ? record.posterUrl : null,
  };
}
