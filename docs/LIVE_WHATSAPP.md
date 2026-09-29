# Live booking & WhatsApp (short notes)

See the full write-up in [AI_SOLVER.md](./AI_SOLVER.md). Instructor: **Prof. Munzer Haddara / الأستاذ منذر حداره**.

## Live

- Teacher hours: staff `/live` or Admin → Live. Default Mon/Wed **16:00–19:00 Asia/Beirut**.
- Students with `LIVE_TIER` / `BOTH` see open slots only if `liveCredits > 0`.
- Book → −1 credit, confirmed session, classroom URL `/live/classroom/{bookingId}` (**انضم للحصة**). Meet/Zoom stubs remain as fallback when LiveKit Cloud keys are unset. Full LiveKit setup: [LIVEKIT.md](./LIVEKIT.md).
- Calendars: student `/live` and admin live table.
- **Immediate WhatsApp** to the teacher on every successful book (`notifyLiveBooked`, kind `live_booked`). Optional student confirmation if `studentPhone` is set. Failures are swallowed so the booking still succeeds.

## WhatsApp env (Netlify)

Set these in **Netlify UI → Site settings → Environment variables** (never invent secrets in git):

| Variable | Purpose |
|---|---|
| `TEACHER_WHATSAPP` | Teacher phone for alerts. Default / `.env.example`: **`96176532421`** |
| `WHATSAPP_PROVIDER` | `ultramsg` or `twilio` |
| UltraMsg | `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| `JOBS_SECRET` | Optional lock for reminder cron |

Without provider keys (or with empty `WHATSAPP_PROVIDER`), messages are **logged** to the WhatsApp outbox (`data/whatsapp-outbox.json`) and visible on the admin dashboard (Admin → WhatsApp). `teacherWhatsApp()` reads `TEACHER_WHATSAPP` (fallback `ACADEMY_WHATSAPP`, then `96176532421`).

## Triggers

- **Immediate** on live book → teacher (and student if phone present), kind `live_booked`
- ~30 min before live → student + teacher (`live_reminder`)
- Card redeem → activation
- AI video complete → student

## Cron

`POST /api/jobs/whatsapp-reminders` with `x-jobs-secret: $JOBS_SECRET` every ~15 min. Empty secret allowed in demo.
