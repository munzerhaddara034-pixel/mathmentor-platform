# Auth, sessions, and lesson protection

Prof. Munzer Haddara / الأستاذ منذر حداره.

This build uses a **file-store session** (`data/auth.json`) — the same style as promo cards and HeyGen jobs. There is still no external IdP.

## What is protected

Unauthenticated visitors to private routes are redirected to `/login` (middleware + server layouts + client fallback).

| Role | Lessons (`/lessons/*`, `/studio/player`, classroom, practice…) | Staff (`/studio/script`, `/admin`, `/professor`…) |
| --- | --- | --- |
| Student / parent with active plan | yes | no |
| Student without plan | `/redeem` (promo/card) | no |
| Teacher / admin | yes | yes |

`?teacher=1` still requires a **logged-in teacher or admin**. Students cannot open the timeline editor.

Private pages send `X-Robots-Tag: noindex, nofollow, noarchive` and `<meta name="robots" content="noindex, nofollow" />`.

## Single session

Each login issues a new opaque cookie (`mm_session`) and **deletes every previous session** for that user. The next request with the old cookie is treated as logged out and sent to `/login?reason=replaced` (English + Arabic message).

The cookie is `Secure` only on HTTPS (or `AUTH_COOKIE_SECURE=1`). `npm start` on `http://localhost` still stores the session.

## Demo accounts (local / Netlify)

The login screen is **logo + title + email/password + Sign in** only. Demo credentials live in this file, not on `/login`.

Seeded on first boot of `data/auth.json`:

| Email | Password | Notes |
| --- | --- | --- |
| `student@mathmentor.local` | `demo-student` | Sara Nassar · 76111111 · plan `all` |
| `pending@mathmentor.local` | `demo-pending` | Karim Fares · no plan → redeem |
| `parent@mathmentor.local` | `demo-parent` | family plan `all` |
| `teacher@mathmentor.local` | `demo-teacher` | Prof. Munzer Haddara |
| `admin@mathmentor.local` | `demo-admin` | staff |

Unlock a pending student while signed in: `/redeem` or `/activate` with card **`MUNZER-GOLD-9A`**.

On Netlify the JSON file store is ephemeral per instance; demo users are re-seeded if the file is missing.

## Watermark

The interactive player overlays **student name + phone** on both the video frame and the math canvas (`pointer-events: none`, slow drift + diagonal copy). Identity comes from the session profile. Missing phone falls back to `76532421`.
