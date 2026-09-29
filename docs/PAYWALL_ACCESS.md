# Paywall & access guard

**Brand:** Prof. Munzer Haddara / الأستاذ منذر حداره only.

## What is gated (AI tier)

Staff (`teacher` / `admin`) are always exempt.

| Surface | Gate | Redirect / status |
| --- | --- | --- |
| `/math-solver` (+ result pages) | `requireAiAccess` + `AuthClientGuard mode="ai"` | `/redeem?need=ai` |
| Interactive lessons `/lessons/*`, `/classroom`, `/student` | `requireLessonAccess` (same as AI) | `/redeem?need=subscription` |
| Official exams `/exams` | `requireAiAccess` | `/redeem?need=ai` |
| `POST /api/solve-math` | `userHasAiAccess` | 403 |
| `POST /api/ai/pedagogical-tutor` | `userHasAiAccess` | 403 |
| `GET/POST /api/tutor` (student desk chat) | `apiRequireAiAccess` | 403 |
| Exam generate / simulator APIs | `userHasAiAccess` | 403 |
| Live voice→board pedagogical step | same tutor API | 403 + redeem hint |

## Live booking (different rules — keep)

| Surface | Gate | Notes |
| --- | --- | --- |
| `/live` booking board | **Public** (guest $25 / member $15 Whish) | Not AI-gated |
| `/live/classroom/*` | `requireAuth` only | Whish guests join via shared link |
| Live credits / LIVE_TIER | `requireLiveAccess` / subscribe flows | Separate from AI |

AI features **inside** a live room (pedagogical tutor via voice-to-board) still require AI_TIER/BOTH.

## Redeem → instant unlock

1. Sign in (e.g. `pending@mathmentor.local` / `demo-pending`).
2. Open `/redeem`, enter a code, submit.
3. On success the client:
   - reads returned `aiAccess` / `liveAccess` / `subscriptionType` / `liveCredits`
   - calls `refreshClientEntitlements()` → `GET /api/auth/session` (`cache: "no-store"`)
   - calls `router.refresh()` so RSC layouts re-run `requireAiAccess` **without logout/login**
4. Open `/math-solver` — should load immediately.

Helper: `src/lib/auth/clientSession.ts`.

## Demo / teacher-testing codes

Documented also in [AUTH.md](./AUTH.md). Seeded scratch cards:

| Code | Plan | Notes |
| --- | --- | --- |
| `MUNZER-GOLD-9A` | all (AI) | Single-use |
| `MUNZER-AI-3K` | ai | Single-use |
| `MUNZER-LIVE-4C` | live | Single-use (+ credits) |
| `MUNZER-BOTH-1X` | both | Single-use |
| `MUNZER-HRS-2H` | live hours top-up | Billing store |
| **`MUNZER-DEMO-TEACHER`** | ai | **Teacher testing only** — `reusable: true`, never sell to students |

## Key files

- `src/lib/auth/guards.ts` — `requireAiAccess`, `apiRequireAiAccess`
- `src/lib/auth/tiers.ts` / `store.ts` — `userHasAiAccess`
- `src/app/redeem/page.tsx` — redeem UI + instant refresh
- `src/lib/exams/accessHook.ts` — soft exams hub copy

Live URL: https://mathmentor-munzer.netlify.app
