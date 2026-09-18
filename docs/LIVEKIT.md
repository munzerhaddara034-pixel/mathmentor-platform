# LiveKit Cloud — live tutoring + math whiteboard

Instructor: **Prof. Munzer Haddara / الأستاذ منذر حداره**. Never Al-Tarah / الطارة.

MathMentor’s live classroom (`/live/classroom/[roomId]`) is a split board: **KaTeX whiteboard** (Lebanese / Word equation formatting) plus a **video grid**, chat, and raise-hand. Media and in-room data go through [LiveKit Cloud](https://livekit.io/cloud). Booking, credits, and session JSON stay on the existing Netlify Blobs / `data/` adapter.

## Environment

Copy from `.env.example` (never commit real secrets):

```
LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-project.livekit.cloud
```

| Variable | Where it is used | Notes |
| --- | --- | --- |
| `LIVEKIT_URL` | Token + Room Service (Node) | `wss://` from the LiveKit Cloud project page. Room Service calls convert this to `https://`. |
| `LIVEKIT_API_KEY` | Server only | Project API key. |
| `LIVEKIT_API_SECRET` | Server only | **Never** prefix with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_LIVEKIT_URL` | Browser `LiveKitRoom` | Same websocket URL as `LIVEKIT_URL`. Safe to expose (no secret). |

On Netlify, set the same keys in Site settings → Environment variables (production + previews). Local: `.env.local` (gitignored). `npm run build` and the demo classroom **do not** need real LiveKit credentials.

## Demo / mock mode (no keys)

If any of `LIVEKIT_URL`, `LIVEKIT_API_KEY`, or `LIVEKIT_API_SECRET` is missing:

- `POST /api/livekit/token` still requires a logged-in MathMentor session.
- It returns **HTTP 200** with `ok: false`, `demo: true`, a clear `error` / `errorAr`, and a `grants` object so the UI can render the **classroom shell** (whiteboard, placeholder tiles, chat, raise-hand).
- The shell does **not** open a WebRTC connection. Whiteboard strokes stay in the tab (and optionally persist via `/api/livekit/whiteboard` on the Blobs/`data/` store).
- Teacher vs student **grants are still encoded** in the JSON (`roomAdmin`, `canPublish`, `canPublishData`, `canSubscribe`).

Open `/live/classroom/demo` after signing in with a live-tier or staff account to exercise the shell.

## How to join

### Teacher / admin (الأستاذ)

1. Sign in as `teacher@mathmentor.local` / `demo-teacher` (or any `teacher` / `admin` role).
2. From `/live`, `/dashboard`, or Admin → Live, click **انضم للحصة**.
3. `POST /api/livekit/token` with `isTeacher: true` (the server **forces** this for staff and **rejects** it for students).
4. Token grants: `roomJoin`, `canPublish: true`, `canSubscribe: true`, `canPublishData: true`, `roomAdmin: true`, `roomCreate: true`.
5. Teacher controls: mute/camera, **Grant whiteboard write** / **Grant camera** per student, **End class for all** (`roomAdmin` + `DELETE` room when keys exist).

Staff may open any room id, including a student’s booking id (`live-…`) or `demo`.

### Student (طالب)

1. Sign in with **LIVE_TIER** or **BOTH** (demo: `student@mathmentor.local` or `live@mathmentor.local`).
2. Book a slot on `/live` (uses one live credit). Confirmation and the calendar show **انضم للحصة**.
3. The classroom URL is `/live/classroom/{bookingId}`.
4. Token grants: `roomJoin`, `canSubscribe: true`, `canPublishData: true` (chat + raise-hand), `canPublish: false` until the teacher grants audio/video, `roomAdmin: false`.
5. Whiteboard **write** is not a LiveKit video grant. The teacher sends a data message / metadata flag (`whiteboard.grant`). Until then the board is view-only.

Students may also open the **demo** room (`/live/classroom/demo`) without a booking. Other room ids require a non-cancelled booking whose id matches the room.

AI-only accounts (`AI_TIER`) are redirected to `/subscribe?need=live` by the `/live` layout.

## Token API

`POST /api/livekit/token` (session cookie required)

```json
{
  "identity": "optional display name",
  "isTeacher": false,
  "room": "live-booking-id",
  "roomName": "alias of room",
  "sessionId": "alias of room"
}
```

- LiveKit **identity** is always the MathMentor user id (clients cannot impersonate).
- `identity` in the body is used as the **display name** when present.
- Response includes `token`, `serverUrl`, `grants`, `isTeacher`, `canWriteBoard`, `canPublishAv`, `demo`.

Related staff routes (teacher/admin session):

| Route | Role |
| --- | --- |
| `POST /api/livekit/permissions` | Grant/revoke student `canPublish` (AV) and whiteboard write. Uses LiveKit `updateParticipant` when keys exist. |
| `POST /api/livekit/end` | End class for all (`deleteRoom` when keys exist). |
| `GET` / `PUT /api/livekit/whiteboard` | Optional stroke/equation snapshot keyed by room (Blobs or `data/livekit-rooms.json`). |

## Whiteboard

The main pane is `MathWhiteboard`: freehand strokes + a LaTeX line that runs through `formatLebaneseEquation` / KaTeX (stacked `\frac`, real superscripts, `\sqrt`, `\lim\limits`, `\int\limits`). Same rules as Voice-to-Math and the solver — see [MATH_FORMATTING.md](./MATH_FORMATTING.md).

v1 sync is the LiveKit **data channel** (topic `mathmentor`). Persistence is best-effort so a refresh can restore the board.

## Booking wiring

`bookSlot` always stores `classroomUrl` / `classroomRoomId`. When LiveKit env is configured, `meetingLink` points at the MathMentor classroom; otherwise the existing Meet/Zoom stub remains as a fallback **and** **انضم للحصة** still opens `/live/classroom/{id}`.

## Packages

`livekit-server-sdk` (tokens + Room Service), `livekit-client`, `@livekit/components-react`, `@livekit/components-styles`.
