# Auth, sessions, and lesson protection

Prof. Munzer Haddara / الأستاذ منذر حداره.

This build uses a **file-store session** (`data/auth.json`) — the same style as promo cards and HeyGen jobs. There is still no external IdP.

## What is protected

Unauthenticated visitors to private routes are redirected to `/login` (middleware + server layouts + client fallback).

| Role | Lessons + solver (`/lessons/*`, `/math-solver`, `/studio/player`…) | Live booking (`/live`) | Staff (`/studio/script`, `/admin`, `/professor`…) |
| --- | --- | --- | --- |
| Student / parent with **AI_TIER** or **BOTH** | yes | BOTH only | no |
| Student with **LIVE_TIER** only | no → `/redeem?need=ai` | yes | no |
| Student without plan | `/redeem` | `/subscribe?need=live` | no |
| Teacher / admin | yes | yes | yes |

`?teacher=1` still requires a **logged-in teacher or admin**. Students cannot open the timeline editor.

Private pages send `X-Robots-Tag: noindex, nofollow, noarchive` and `<meta name="robots" content="noindex, nofollow" />`.

## Device sessions (1 mobile + 1 desktop)

Each login issues a new opaque cookie (`mm_session`) and records a device fingerprint (`userAgent + screen + timezone + localStorage deviceId`). The account may keep **one mobile and one desktop** session. A second login of the *same class* deletes the previous session of that class. The old cookie is then treated as logged out and sent to `/login?reason=replaced` (English + Arabic).

The cookie is `Secure` only on HTTPS (or `AUTH_COOKIE_SECURE=1`). `npm start` on `http://localhost` still stores the session.

On Netlify/Lambda, JSON stores live under `/tmp/mathmentor-data`.

## Demo accounts (local / Netlify)

The login screen is **logo + title + email/password + Sign in** only. Demo credentials live in this file, not on `/login`.

Seeded on first boot of `data/auth.json`:

| Email | Password | Notes |
| --- | --- | --- |
| `student@mathmentor.local` | `demo-student` | Sara Nassar · 76111111 · **BOTH** · 4 live credits |
| `ai@mathmentor.local` | `demo-ai` | Nour Khalil · **AI_TIER** (solver + lessons) |
| `live@mathmentor.local` | `demo-live` | Hassan Mansour · **LIVE_TIER** · 4 credits |
| `pending@mathmentor.local` | `demo-pending` | Karim Fares · no plan → redeem |
| `parent@mathmentor.local` | `demo-parent` | family **AI_TIER** |
| `teacher@mathmentor.local` | `demo-teacher` | Prof. Munzer Haddara |
| `admin@mathmentor.local` | `demo-admin` | staff |

Unlock while signed in on `/redeem` or `/activate`:

- **`MUNZER-GOLD-9A`** / **`MUNZER-AI-3K`** — AI lessons + solver
- **`MUNZER-LIVE-4C`** — live 1-on-1 (+4 credits)
- **`MUNZER-BOTH-1X`** — bundle (+8 credits)

AI solver, live booking, WhatsApp, teacher audit: [AI_SOLVER.md](./AI_SOLVER.md) · [LIVE_WHATSAPP.md](./LIVE_WHATSAPP.md).

On Netlify the JSON file store is ephemeral per instance (`/tmp/mathmentor-data`); demo users are re-seeded if the file is missing.

## Watermark

Video players, `/lessons/interactive`, and AI solution pages overlay drifting **`[Student Name] - [Phone Number] - [Current Date]`** (Asia/Beirut). Identity comes from the session profile. Missing phone falls back to `76532421`. Demo student: Sara Nassar · 76111111.

Retention modules (exam simulator, streaks, bell, wallet): [RETENTION.md](./RETENTION.md).
