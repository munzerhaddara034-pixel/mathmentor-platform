# HeyGen hybrid lesson videos

Daily teacher workflow for **منصة الأستاذ منذر حداره / MathMentor**:

1. Write (or generate) the bilingual lesson in [`/studio/script`](/studio/script) (`leb-term-func-01` is seeded).
2. Open [`/admin/video-generator`](/admin/video-generator), paste the narration, notes, math examples, language, speed, and timeline JSON / lesson id.
3. Click **Generate Video** → `POST /api/heygen/generate`.
4. Wait for **webhook** (`POST /api/heygen/webhook`) or poll `GET /api/heygen/status?jobId=…`.
5. When status is `completed`, `videoUrl` is stored on the job **and** the lesson overlay is **enabled for students**.
6. Students watch [`/lessons/interactive`](/lessons/interactive) (or `/studio/player?job=…`): **left = Math Canvas**, **right = HeyGen video** (video on top on phones). Canvas actions follow `video.currentTime`.

No `HEYGEN_API_KEY` is required for local demo / `npm run build`. The generate route then returns a **deterministic mock job id** (`demo-<sha1>`) and status polling completes after ~2.5s with `/studio/demo-avatar.mp4` (or silent avatar if that file is missing).

## Environment

Copy from `.env.example` (never commit real secrets):

| Variable | Required | Where |
| --- | --- | --- |
| `HEYGEN_API_KEY` | for live HeyGen | **server only** |
| `HEYGEN_AVATAR_ID` | for live avatar | server |
| `HEYGEN_VOICE_ID` | optional default voice | server |
| `HEYGEN_VOICE_ID_EN` / `_FR` / `_AR` | optional per language | server |
| `HEYGEN_TALKING_PHOTO_ID` | used if `HEYGEN_AVATAR_ID` is empty | server |
| `HEYGEN_WEBHOOK_SECRET` | optional | compared on webhook |
| `NEXT_PUBLIC_APP_URL` | optional | `{url}/api/heygen/webhook` sent as `callback_url` |
| `HEYGEN_ADMIN_TOKEN` | optional | locks generate/list if set |

This app requires a **teacher/admin session** for generate/list (`teacher@mathmentor.local` / `demo-teacher`). `HEYGEN_ADMIN_TOKEN` remains an optional bearer override (`x-admin-token` or `Authorization: Bearer …`). See [AUTH.md](./AUTH.md).

## Exact v2 generate payload

`POST https://api.heygen.com/v2/video/generate`

Headers:

- `Content-Type: application/json`
- `Accept: application/json`
- `X-Api-Key: <HEYGEN_API_KEY>`

Body (built by `buildHeyGenGeneratePayload` in `src/lib/studio/heygen.ts`):

```json
{
  "caption": false,
  "title": "MathMentor · leb-term-func-01",
  "callback_id": "<our job id>",
  "callback_url": "https://your-app.example/api/heygen/webhook",
  "dimension": { "width": 1280, "height": 720 },
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "<HEYGEN_AVATAR_ID>",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "<lesson script, max 4000 chars>",
        "voice_id": "<HEYGEN_VOICE_ID or language-specific>",
        "speed": 1.0,
        "locale": "en-US"
      },
      "background": {
        "type": "color",
        "value": "#10213d"
      }
    }
  ]
}
```

Notes:

- `callback_id` / `callback_url` are omitted when `NEXT_PUBLIC_APP_URL` is empty.
- `voice_id` is omitted when no voice env/id is set so HeyGen can use the avatar default.
- If `HEYGEN_AVATAR_ID` is empty, `character` is `{ "type": "talking_photo", "talking_photo_id": "<HEYGEN_TALKING_PHOTO_ID>" }`.
- `voice.speed` is clamped to **0.5–1.5** (HeyGen OpenAPI).
- `voice.locale`: `en-US` | `fr-FR` | `ar-SA`.
- Landscape **1280×720** so the clip fits the right-hand avatar panel.

Successful HeyGen response (used fields): `data.video_id`.

## Status polling

`GET https://api.heygen.com/v1/video_status.get?video_id=<id>` with `X-Api-Key`.

Mapped fields: `data.status`, `data.video_url`, `data.thumbnail_url`, `data.duration`.

App mapping → job status:

| HeyGen | Job |
| --- | --- |
| pending / waiting | `queued` (then `processing` once we have a video_id) |
| processing / running | `processing` |
| completed / done / success | `completed` (+ `studentEnabled`) |
| failed / error | `failed` |

Local poll: `GET` or `POST /api/heygen/status?jobId=…` (also accepts `video_id`). Without a key, demo jobs advance on their own; **no outbound HeyGen HTTP**.

## Webhook

`POST /api/heygen/webhook`

Accepted JSON shapes (HeyGen has used both):

```json
{
  "event_type": "avatar_video.success",
  "event_data": {
    "video_id": "…",
    "url": "https://…",
    "callback_id": "<our job id>"
  }
}
```

```json
{
  "data": {
    "video_id": "…",
    "video_url": "https://…",
    "callback_id": "…",
    "status": "completed"
  }
}
```

If `HEYGEN_WEBHOOK_SECRET` is set, one of these must match it: `x-heygen-signature`, `x-webhook-secret`, `Authorization: Bearer`, `?secret=`, or JSON `secret`. If the env is empty, the route accepts callbacks (local demo).

On `completed`, the job gets `videoUrl`, `studentEnabled: true`, and `data/heygen-jobs.json` `lessons[lessonId]` is updated so `/lessons/interactive` plays the clip.

## Persistence

JSON file store (same pattern as promo codes / `data/store.json`):

- `data/heygen-jobs.json` (gitignored)
- Job fields: `lessonId`, `script`, `notes`, `mathExamples`, `language`, `speed`, `status`, `heygenVideoId`, `videoUrl`, `studentEnabled`, `timelineJson`, timestamps

There is no SQLite in this project.

## Sync player

When `timeline.media.videoUrl` is set:

- **Left** panel: interactive math canvas (KaTeX fade-in + Function Plot SVG; Desmos if `NEXT_PUBLIC_DESMOS_API_KEY` is set).
- **Right** panel: `<video src={videoUrl}>` (HeyGen when available, else local `/studio/demo-avatar.mp4`). On phones the video stacks **on top**.
- Canvas `currentTime` is driven by `video.ontimeupdate` / `seeked`. A short clip **loops** after it ends so pan/zoom does not pause audio while RAF continues the lesson clock.
- EN/FR toggle is unchanged.
