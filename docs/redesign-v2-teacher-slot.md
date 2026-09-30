# Redesign v2 — teacher live slot

The teacher slot is the 16:9 box on the home booking card and the dashboard "Your next session" card.
It reserves its aspect ratio before any media loads, so the layout does not shift (CLS 0).

| State | What renders |
|---|---|
| `live` | Red LIVE badge, title and viewers (only if known), and a button to the live room (`roomHref`). |
| `live` + data saver | The same captions over the still `posterUrl`. No video or autoplay. Triggered by the head script: `Save-Data`, a 2g connection, or the visitor's own `mm-data-saver` toggle, which sets `html.data-saver`. |
| `offline` | The enhanced teacher photo (`public/teachers/munzer-slot*.webp`) and a note built from the **real** next free slot (`availableSlots()`). |

## Current wiring: stub

- `src/lib/live/teacherLiveStatus.ts`: `getTeacherLiveStatus()` returns `{ state: "offline" }` and does
  no I/O. `TEACHER_LIVE_STATUS_ENDPOINT` is `null`.
- `src/components/v2/TeacherSlotServer.tsx`: calls `getTeacherLiveStatus()` on the server, so the first
  paint already shows the right state. If the endpoint is set, it hands off to the client poller.
- `src/components/v2/useTeacherLiveStatus.ts`: polls every 30 s only while the tab is visible, uses
  try/catch plus a timeout, and falls back to offline if anything fails or returns malformed data
  (`parseTeacherLiveStatus`).
- `src/components/v2/TeacherSlot.tsx`: a pure view with no data fetching.

## To make it real

1. Add a LiveKit webhook route (`room_started`, `participant_joined` / `participant_left`,
   `room_finished`) that verifies the LiveKit signature. It upserts a single `teacher_live_status` row
   `{ roomId, title, viewers, startedAt, posterUrl }` and clears it on `room_finished`.
2. Read that row in `getTeacherLiveStatus()`, cached for about 5 s.
3. Add `GET /api/live/teacher-status` that returns the same JSON, then set
   `TEACHER_LIVE_STATUS_ENDPOINT = "/api/live/teacher-status"`.

Never invent viewers, titles or times: `null` means "unknown" and is simply not shown.
