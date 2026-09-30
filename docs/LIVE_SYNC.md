# Live classroom sync (Task 1)

Instructor: **Prof. Munzer Haddara / الأستاذ منذر حداره**. Never Al-Tarah / الطارة.

## Goal

Harden `/live` and `/live/classroom/[roomId]` so teacher vs student LiveKit roles are correct and the math whiteboard (strokes, KaTeX equations, plots) stays in sync with low latency — without requiring a new paid realtime vendor on Netlify.

## Token roles — `POST /api/livekit/token`

Always requires a MathMentor session cookie. Always runs `assertClassroomAccess`.

| Role | Who | LiveKit grants | App permissions |
| --- | --- | --- | --- |
| Teacher | `teacher` / `admin` when `isTeacher !== false` | `canPublish`, `canSubscribe`, `canPublishData`, `roomAdmin`, `roomCreate` | Full whiteboard write; can grant board/AV; can end class |
| Student | live-tier user with booking (or `demo` room) | `canSubscribe`, `canPublishData` (hand + chat); `canPublish` only if granted | Whiteboard **view** until teacher grants write |

Students cannot mint teacher tokens (`isTeacher: true` → 403). Demo room `demo` is joinable without a booking. Ending a class returns 410 for students.

## Whiteboard sync strategy (chosen)

**Primary:** existing **LiveKit data messages** on topic `mathmentor` (no new dependency, reuses the media room).

**Fallback (Netlify / demo without LiveKit keys):** HTTP **poll** of `GET /api/livekit/whiteboard?room=…` every ~1.5s (every ~8s as backup when LiveKit is live). Writers also `PUT` snapshots (strokes / equations / plots) for persistence and late joiners.

Why not Yjs / PartyKit / Liveblocks for this phase: would add a paid or extra hosted service; LiveKit data + Blobs/`data/` already fit the stack.

### Message kinds

- `whiteboard.stroke` / `whiteboard.equation` / `whiteboard.plot`
- `whiteboard.clear` / `whiteboard.grant`
- `av.grant` / `hand` / `chat` / `class.end`

Plots are lightweight `y = f(x)` pins (`expression`, `xMin`, `xMax`) rendered with the studio function-plot helper — no Desmos key required.

## UI modules (not monolith)

- `LiveClassroomComponent` — token fetch, poll sync, stage state
- `LiveConnectedRoom` — LiveKit room + data channel
- `ClassroomStage` / `MathWhiteboard` / `VoiceToBoardPanel` / `LiveBoardPlot`
- `ClassroomTokenSkeleton` on load (mobile-first)

## How to test

1. **Teacher:** sign in with a staff account (`ADMIN_EMAILS`) → open `/live/classroom/demo` → draw, pin equation, pin plot, use Voice to board (demo transcript; Whisper optional).
2. **Student:** another browser with a student account that has live access → same `/live/classroom/demo` → board should update (LiveKit data if keys set; otherwise HTTP poll).
3. Confirm student cannot write until teacher clicks **Grant board**; AV stays locked until **Grant AV**.
4. Without LiveKit env: UI shell still works (`demo: true`); sync uses poll + PUT.

## LiveKit status

If `LIVEKIT_URL` + `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` are set (and `NEXT_PUBLIC_LIVEKIT_URL` for the browser), tokens mint and WebRTC connects. Otherwise the classroom runs in mock/shell mode with HTTP board sync.

See also [LIVEKIT.md](./LIVEKIT.md). OpenAI Whisper remains optional / postponed for voice-to-board.
