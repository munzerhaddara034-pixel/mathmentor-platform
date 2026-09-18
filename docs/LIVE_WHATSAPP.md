# Live booking & WhatsApp (short notes)

See the full write-up in [AI_SOLVER.md](./AI_SOLVER.md). Instructor: **Prof. Munzer Haddara / الأستاذ منذر حداره**.

## Live

- Teacher hours: staff `/live` or Admin → Live. Default Mon/Wed **16:00–19:00 Asia/Beirut**.
- Students with `LIVE_TIER` / `BOTH` see open slots only if `liveCredits > 0`.
- Book → −1 credit, confirmed session, classroom URL `/live/classroom/{bookingId}` (**انضم للحصة**). Meet/Zoom stubs remain as fallback when LiveKit Cloud keys are unset. Full LiveKit setup: [LIVEKIT.md](./LIVEKIT.md).
- Calendars: student `/live` and admin live table.

## WhatsApp

- `WHATSAPP_PROVIDER=twilio|ultramsg`. No keys → messages land in `data/whatsapp-outbox.json` (Admin → WhatsApp).
- Triggers: 30 min before live (student + teacher), card redeem, AI video complete.
- Cron: `POST /api/jobs/whatsapp-reminders` with `x-jobs-secret: $JOBS_SECRET` every ~15 min. Empty secret allowed in demo.
