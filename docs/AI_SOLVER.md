# AI Math Solver, live booking, WhatsApp, teacher audit

Prof. Munzer Haddara / الأستاذ منذر حداره. Never Al-Tarah / الطارة.

Students submit a math question (text, LaTeX, or image). The engine returns a structured solution, an avatar script, and a time-synced Math Canvas. A HeyGen talking-avatar clip is generated when keys exist; otherwise the demo player uses `/studio/demo-avatar.mp4` and still drives the board from `video.currentTime`.

## Solver response (Lebanese exam accuracy)

Every solution — Gemini, OpenAI, or the demo engine — has three sections **and** follows the official study sequence. Full contract: [PEDAGOGY.md](./PEDAGOGY.md).

1. **Given & Aim** (`given.latex`, `given.aimEn` / `aimFr` / `aimAr`) · المعطيات والمطلوب
2. **Step-by-step** with a named theorem/reason on every line (`theoremEn` / `theoremFr` / `theoremAr`) and **pure LaTeX** (`f'(x)`, `\int`, `\lim`, `\ln`, `e^{x}`, `z=a+ib`)
3. **Final Answer Box** (`finalAnswerLatex`) — framed in the UI. Student math is passed through the Lebanese / Word Insert Equation cleaner (`\frac{a}{b}`, `x^{n}`, `\sqrt`, `\lim\limits`, `\int\limits`) so slash fractions, visible carets, and the letters `sqrt` never reach the canvas. Contract: [MATH_FORMATTING.md](./MATH_FORMATTING.md).

For a real-function study the steps are, in order:

1. Domain of definition **D_f** (before any further study)
2. Limits at the boundaries with asymptote equations `x=a`, `y=b`, or `y=ax+b`
3. Derivative, sign, **table of variations** (arrows, limits, images)
4. Particular points and graph of **C_f**

The avatar script speaks a **Key Idea / Exam Tip** *before* any calculation, then the sequence, then **Common pitfalls** that lose barème marks. Each sub-question is a `boxAnswer` on the canvas.

Hallucination guard: if the photo or text is blurry, cropped, or incomplete, the engine **does not invent**. It returns `needsRetake: true` plus `retakeMessageEn` / `retakeMessageAr` and asks the student to rephotograph. Without Gemini, an image-only request (no typed math) is always a retake; garbled text (`asdf…`) is a retake; typed math is solved and the photo is ignored with a warning.

## Routes

| Surface | Auth / tier |
| --- | --- |
| `/math-solver` | login + **AI_TIER** or **BOTH** (staff bypass) |
| `POST /api/solve-math` | same; JSON or `multipart/form-data` (`question`, `latex`, `language`, `track`, `image`) |
| `GET /api/solve-math` | own queries (staff: all) |
| `GET /api/solve-math/[id]` | owner or staff |
| `PATCH /api/solve-math/[id]` | `{ rating: 1 \| -1 }` student 👍/👎 |
| `/math-solver/result/[id]` | three-section sheet + rating + player |
| `/lessons/interactive-explanation?id=` | split HeyGen + canvas (`InteractiveLessonPlayer`) |
| `POST /api/generate-avatar-video` | `{ queryId }` or `{ script, timelineJson }` → HeyGen `v2/video/generate` |
| `POST /api/generate-explanation` | alias of generate-avatar-video |
| `/live` | login + **LIVE_TIER** or **BOTH**; students see slots only if `liveCredits > 0` |
| `/live/classroom/[roomId]` | LiveKit classroom (whiteboard + video). Demo shell without keys. [LIVEKIT.md](./LIVEKIT.md) |
| `POST /api/livekit/token` | session JWT for LiveKit; teacher vs student grants |
| `GET/POST /api/live/slots`, `POST /api/live/book` | book decrements 1 credit, confirms, writes a classroom URL |
| `GET/PUT /api/live/availability` | teacher weekly hours (e.g. Mon/Wed 16:00–19:00 `Asia/Beirut`) |
| `/admin` · `/admin/audit` | staff: query log, ratings, verify / needs-fix, stats, WhatsApp outbox |
| `PATCH /api/admin/queries` | `{ id, auditStatus, auditNote }` |
| `POST /api/jobs/whatsapp-reminders` | 30-min live reminders + catch-up video notices |
| `/admin/video-generator` | existing HeyGen teacher tool |
| `/studio/voice-solver` | Teacher **Voice-to-Math** recorder (staff). See [VOICE_MATH.md](./VOICE_MATH.md) |

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
   - JSON includes `given`, `examTip`, `steps[].theoremEn`, `finalAnswerLatex`, `needsRetake`, `topicTag`.
   - Demo `f(x)=(x-1)e^x` is Domain → Limits (`y=0`) → f' / variation table → min (0,−1), with a Key Idea before the algebra.
4. Rate 👍/👎 on the result page (stored for teacher audit).
5. **Generate avatar explanation** calls `POST /api/generate-avatar-video` and stores a demo HeyGen job. Poll `GET /api/heygen/status?jobId=…` ([HEYGEN.md](./HEYGEN.md)). A WhatsApp (or outbox log) notifies the student when the job completes.
6. Unclear photo with no typed math → retake banner, no invented quadratic.

## Live 1-on-1

Teacher (staff `/live` or admin Live tab): set weekdays + hours, default **Mon/Wed 16:00–19:00 Asia/Beirut**. Saving regenerates open 45-minute slots.

Student: `/live` lists only future open slots when `liveCredits > 0`. Booking:

1. Decrements 1 credit
2. Creates a confirmed session
3. Issues a classroom URL `/live/classroom/{bookingId}` (**انضم للحصة**)
   - **LiveKit Cloud** when `LIVEKIT_*` keys are set ([LIVEKIT.md](./LIVEKIT.md))
   - **Google Meet stub** `https://meet.google.com/xxx-xxxx-xxx` if no LiveKit/Zoom keys (classroom URL still present)
   - **Zoom stub** `https://zoom.us/j/…` if `ZOOM_ACCOUNT_ID` is set without OAuth
   - **Real Zoom** `POST /users/me/meetings` when `ZOOM_ACCOUNT_ID` + `ZOOM_CLIENT_ID` + `ZOOM_CLIENT_SECRET` are present
   - **Meet template** `GOOGLE_MEET_LINK_TEMPLATE` with `{id}` / `{code}`
4. Link appears on the student calendar and the admin live calendar

Cancel from admin refunds the credit.

## WhatsApp (Twilio or UltraMsg)

`WHATSAPP_PROVIDER=twilio|ultramsg`. Tokens: see `.env.example`.

| Provider | Env |
| --- | --- |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (`whatsapp:+1415…`) |
| UltraMsg | `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN` |
| Teacher copy | `TEACHER_WHATSAPP` (default `96176532421`) |

Without keys the adapter **logs** outbound text to `data/whatsapp-outbox.json` (Admin → WhatsApp tab). Demo still works.

Triggers:

- **30 minutes before** a live session → student + teacher phones, with join link
- **Card activation** (`POST /api/redeem`) → confirmation + code
- **AI explanation video complete** (HeyGen webhook / status poll / demo generate)

### Cron

```bash
curl -X POST "$ORIGIN/api/jobs/whatsapp-reminders" \
  -H "x-jobs-secret: $JOBS_SECRET"
```

- Header `x-jobs-secret` or `Authorization: Bearer $JOBS_SECRET`
- Staff session also authorized
- Empty `JOBS_SECRET` allows the POST so local / Netlify QA works without secrets (set a secret in production)

Schedule: every 10–15 minutes (Netlify scheduled function, cron-job.org, or GitHub Action) so the 20–40 minute reminder window is hit. Catch-up also notifies completed videos that were not messaged yet.

Netlify example (`netlify.toml`):

```toml
[functions."whatsapp-reminders"]
  schedule = "*/15 * * * *"
```

Or a scheduled fetch to the Next route above. `GET` on the same path is accepted for simple uptime pings.

## With keys

| Env | Effect |
| --- | --- |
| `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) | Text + Vision via Gemini `generateContent`. `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Unclear images return `needsRetake`. |
| `OPENAI_API_KEY` / `LLM_API_KEY` | Text-only fallback if Gemini is unset. |
| `HEYGEN_API_KEY` + `HEYGEN_AVATAR_ID` | Real `POST https://api.heygen.com/v2/video/generate`. |
| Zoom / Meet / WhatsApp | as above |

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

## Admin / teacher audit

`/admin` and `/admin/audit` tabs:

- **Overview** — questions answered today (Asia/Beirut), hardest topics (solver `topicTag` + 👎), live sessions booked this week
- **Teacher audit / AI Query Logs** — question, image thumb, AI answer, 👍/👎, Verify / Mark needs fix + correction notes
- **Live Requests** — calendar, weekly hours editor, confirm / cancel, meeting link
- **Students** — plan, tier, live credits
- **WhatsApp** — outbox (logged or sent)

JSON stores (gitignored locally; **Netlify Blobs** `mathmentor-data` in production — see [AUTH.md](./AUTH.md)):

- `auth.json`
- `math-queries.json`
- `live-sessions.json`
- `heygen-jobs.json`
- `whatsapp-outbox.json`
