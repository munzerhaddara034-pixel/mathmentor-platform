# AI Math Solver & interactive explanations

Prof. Munzer Haddara / الأستاذ منذر حداره. Never Al-Tarah / الطارة.

Students submit a math question (text, LaTeX, or image). The engine returns a structured solution, an avatar script, and a time-synced Math Canvas. A HeyGen talking-avatar clip is generated when keys exist; otherwise the demo player uses `/studio/demo-avatar.mp4` and still drives the board from `video.currentTime`.

## Routes

| Surface | Auth / tier |
| --- | --- |
| `/math-solver` | login + **AI_TIER** or **BOTH** (staff bypass) |
| `POST /api/solve-math` | same; JSON or `multipart/form-data` (`question`, `latex`, `language`, `track`, `image`) |
| `GET /api/solve-math` | own queries (staff: all) |
| `GET /api/solve-math/[id]` | owner or staff |
| `/math-solver/result/[id]` | solution sheet + player |
| `/lessons/interactive-explanation?id=` | split HeyGen + canvas (`InteractiveLessonPlayer`) |
| `POST /api/generate-avatar-video` | `{ queryId }` or `{ script, timelineJson }` → HeyGen `v2/video/generate` |
| `POST /api/generate-explanation` | alias of generate-avatar-video |
| `/live` | login + **LIVE_TIER** or **BOTH** |
| `GET/POST /api/live/slots`, `POST /api/live/book` | live booking |
| `/admin` | staff: AI Query Logs, Live Requests, student analytics |
| `/admin/video-generator` | existing HeyGen teacher tool |

Private pages keep `noindex`, single-session cookies, and identity watermarks from [AUTH.md](./AUTH.md).

## Demo flow (no API keys)

```bash
npm install
npm run dev
```

1. Sign in: `student@mathmentor.local` / `demo-student` (BOTH, 4 live credits). See [AUTH.md](./AUTH.md).
2. Open `/math-solver`. Tap **x² − 5x + 6 = 0** (or type a limit / `f(x)=(x-1)e^x` / a 2×2 system / 3-4-5 triangle).
3. **Solve with Prof. Munzer AI** → `/math-solver/result/[id]`.
   - `source: "demo"` when `GEMINI_API_KEY` and `OPENAI_API_KEY` are empty.
   - JSON includes `summary`, `finalAnswer`, step-by-step LaTeX, `avatarScript`, `canvasTimeline`.
4. The result page already mounts the split player with the mock avatar clip and a four-phase canvas (intro → rule+graph → graded steps → exam trap). Pause / rewind; the board rebuilds from `canvasStateAt`.
5. **Generate avatar explanation** calls `POST /api/generate-avatar-video` and stores a demo HeyGen job (`demo-<sha1>`). Poll `GET /api/heygen/status?jobId=…` the same way as classroom videos ([HEYGEN.md](./HEYGEN.md)).
6. **Open split player** → `/lessons/interactive-explanation?id=…`.

Photo path without Gemini: attach any image; the demo vision maps it to a Brevet quadratic so the pipeline still completes.

## With keys

| Env | Effect |
| --- | --- |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Text + Vision via Gemini `generateContent`. `GEMINI_MODEL` defaults to `gemini-2.5-flash`. |
| `OPENAI_API_KEY` / `LLM_API_KEY` | Text-only fallback if Gemini is unset. |
| `HEYGEN_API_KEY` + `HEYGEN_AVATAR_ID` | Real `POST https://api.heygen.com/v2/video/generate` (same payload builder as `/api/heygen/generate`). |

Copy `.env.example` → `.env.local`. Never commit secrets.

## Dual-tier subscriptions

| `subscriptionType` | Access |
| --- | --- |
| `AI_TIER` | Lessons, solver, auto explanations |
| `LIVE_TIER` | 1-on-1 booking with Prof. Munzer (`liveCredits`) |
| `BOTH` | All of the above |
| `EXPIRED` / null | Redeem a card |

Promo codes (signed in on `/redeem`):

- `MUNZER-GOLD-9A` / `MUNZER-AI-3K` → AI
- `MUNZER-LIVE-4C` → Live (+4 credits)
- `MUNZER-BOTH-1X` → bundle (+8 credits)

Extra QA logins: `ai@mathmentor.local` / `demo-ai`, `live@mathmentor.local` / `demo-live`.

## Admin

`/admin` tabs:

- **Overview** — activations, active subscriptions, query and booking counts
- **AI Query Logs** — student question, image ref, solution, video job status
- **Live Requests** — confirm / cancel, meeting link, availability editor
- **Students** — plan, tier, live credits

File stores (gitignored, same pattern as `data/auth.json`):

- `data/math-queries.json`
- `data/live-sessions.json`
- `data/heygen-jobs.json`
