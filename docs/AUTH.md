# Auth, sessions, and lesson protection

Prof. Munzer Haddara / الأستاذ منذر حداره.

This build uses a **JSON session store** (`auth.json`) — the same adapter as promo cards, HeyGen jobs, live bookings, and notifications. There is still no external IdP.

## Persistence (Netlify Blobs vs local)

`readJsonFile` / `writeJsonFile` in `src/lib/dataDir.ts` pick a backend:

| Runtime | Where `auth.json` (and other JSON stores) live |
| --- | --- |
| **Netlify production** / `netlify dev` / Lambda (`NETLIFY`, `AWS_LAMBDA_FUNCTION_NAME`, …) | **Netlify Blobs**, site-scoped store `mathmentor-data`, key = filename (`auth.json`, `store.json`, …). Strong consistency so a login on one function instance is visible on the next request. |
| Local `next dev` / `next start` | Gitignored `data/` folder on disk. |

Cold start / missing blob seeds the demo accounts (same table as below). Set `NETLIFY_BLOBS_DISABLED=1` only to force the filesystem fallback.

**Do not store sessions in `/tmp`.** `/tmp/mathmentor-data` is per-instance and ephemeral. That was the production bug: login wrote `auth.json` on instance A; the next navigation hit instance B with an empty file; `findSessionByToken` missed; the UI treated it as `/login?reason=replaced`.

Binary uploads (solver images under `public/uploads`) stay on the local disk / `/tmp` and are not Blobs-backed. Voice-to-Math job JSON and recorded audio (`voice-math.json`, `voice-audio-*.json`) use the same Blobs/filesystem JSON helpers.

## What is protected

Unauthenticated visitors to private routes are redirected to `/login` (middleware + server layouts + client fallback).

| Role | Lessons + solver (`/lessons/*`, `/math-solver`, `/studio/player`…) | Live booking (`/live`) | Staff (`/studio/script`, `/studio/voice-solver`, `/admin`, `/professor`…) |
| --- | --- | --- | --- |
| Student / parent with **AI_TIER** or **BOTH** | yes | BOTH only | no |
| Student with **LIVE_TIER** only | no → `/redeem?need=ai` | yes | no |
| Student without plan | `/redeem` | `/subscribe?need=live` | no |
| Teacher / admin | yes | yes | yes |

`?teacher=1` still requires a **logged-in teacher or admin**. Students cannot open the timeline editor.

Private pages send `X-Robots-Tag: noindex, nofollow, noarchive` and `<meta name="robots" content="noindex, nofollow" />`.

## Device sessions (students vs teacher)

Each login issues a new opaque cookie (`mm_session`) and records a device fingerprint (`userAgent + screen + timezone + localStorage deviceId`). Device names shown in the UI are derived from the User-Agent (e.g. `Windows Chrome`, `iPhone Safari`, `Android Chrome`) plus a Desktop/Mobile label. Timestamps use **Asia/Beirut**.

**Students / parents:** the account may keep **one mobile and one desktop** session. A second login of the *same class* deletes the previous session of that class **and records that token hash in `revokedTokens`**. The old cookie is then sent to `/login?reason=replaced` (English + Arabic). One phone **and** one computer may stay signed in together.

**Teacher / admin** (role `teacher` or `admin`, including `teacher@mathmentor.local`): prior sessions are **not** invalidated when signing in from another device. The professor can stay logged in on two or more desktops. Instead, every successful staff login creates an in-app notification «جهاز جديد نشط / New active device» naming that device. Alerts appear in the header bell and on `/dashboard` together with an **أجهزتي النشطة / Active devices** card. Re-login from the *same* browser only replaces that browser’s own ghost session.

`getLiveSession` reasons:

| Cookie | Live session row | `revokedTokens` hit | `reason` | Login copy |
| --- | --- | --- | --- | --- |
| missing | — | — | `unauthenticated` | none (plain sign-in) |
| present | missing | **yes** (student same-class kick) | `replaced` | “signed in on another device” |
| present | missing | **no** (empty store, TTL, logout leftover) | `expired` | “session ended, sign in again” — **not** “another device” |

`replaced` is reserved for an explicit kick. A missing blob or a new function instance must never show the “another device” message.

The cookie is `Secure` only on HTTPS (or `AUTH_COOKIE_SECURE=1`). `npm start` on `http://localhost` still stores the session.

## Demo accounts (local / Netlify)

The login screen is **logo + title + email/password + Sign in** only. Demo credentials live in this file, not on `/login`.

Seeded on first boot of `auth.json` (Blobs or `data/`):

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

## How to verify

**Adapter + kick markers (no browser)**

```bash
npx tsx scripts/verify-auth-persistence.ts
```

This checks: shared-backend `auth.json` survives a simulated second instance; cookie + missing row without `revokedTokens` is `expired` not `replaced`; student same-class login records a real replacement; teacher second desktop is not kicked.

**Local app**

1. `npm run dev`. Sign in as `teacher@mathmentor.local` / `demo-teacher`.
2. Open `/dashboard`, then `/lessons/interactive`, then `/studio/script`. You must **not** land on `/login?reason=replaced`.
3. Student kick: sign in as `student@mathmentor.local` on two desktop profiles. The first session should redirect to `/login?reason=replaced` on the next navigation.

**Netlify production**

1. Deploy this branch. In the Netlify UI, Blobs → store `mathmentor-data` should gain key `auth.json` after the first login.
2. Sign in as Prof. Munzer Haddara (`teacher@mathmentor.local`). Click dashboard, lessons, and studio. Function logs may show different instance IDs; the session cookie must still work (no `reason=replaced`).
3. Repeat the student same-class kick from two browsers. That path still sets `replaced` because the kicked token hash is stored in `revokedTokens` on the shared blob.

## Watermark

Video players, `/lessons/interactive`, and AI solution pages overlay drifting **`[Student Name] - [Phone Number] - [Current Date]`** (Asia/Beirut). Identity comes from the session profile. Missing phone falls back to `76532421`. Demo student: Sara Nassar · 76111111.

Retention modules (exam simulator, streaks, bell, wallet): [RETENTION.md](./RETENTION.md).
