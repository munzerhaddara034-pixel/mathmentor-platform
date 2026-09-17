# Retention modules (anti-sharing, exams, streaks, alerts, wallet)

Instructor: **Prof. Munzer Haddara** / **الأستاذ منذر حداره**. Branding: **MathMentor · أكاديمية منذر حداره**. Never Al-Tarah / الطارة.

File stores use `/tmp/mathmentor-data` on Netlify/Lambda (`NETLIFY` or `AWS_LAMBDA_FUNCTION_NAME`), otherwise the project `data/` folder. Same pattern as `auth.json` and live sessions.

No extra env vars are required. Demo accounts stay in [AUTH.md](./AUTH.md) (not on `/login`).

Sign in as `student@mathmentor.local` / `demo-student` unless noted.

## 1) Anti-account sharing

- Fingerprint hash: `userAgent + screen + timezone + localStorage mm_device_id`.
- Concurrent sessions: **1 mobile + 1 desktop** per account. A second login of the *same class* invalidates the previous device of that class (`/login?reason=replaced`).
- One phone **and** one computer may stay signed in together.

**How to test the kick**

1. Sign in on Chrome (desktop). Open `/lessons/interactive`.
2. In DevTools → Application → Local Storage set `mm_qa_device_class` to `desktop` (already desktop) **or** open a second desktop browser profile and sign in with the same account. The first session is closed on the next navigation.
3. To keep both classes: in one browser set `mm_qa_device_class` = `mobile`, in the other leave it unset (desktop). Both sessions stay.
4. Watermark on video players, `/lessons/interactive`, `/math-solver/result/…`, and `/lessons/interactive-explanation`: drifting `[Name] - [Phone] - [DD/MM/YYYY]` (Asia/Beirut date). Sara Nassar · 76111111.

## 2) Lebanese official exam simulation

Routes: `/exams` · `/exams/simulator?paper=brevet-2024-demo`

Seeded papers: Brevet, Terminale LS, Terminale GS, Terminale SE (Part I / Part II, Question 1-a / 1-b, live countdown).

Formula drawer (KaTeX): Logarithms, Integrals, Probability, Complex Numbers.

**Submit → PDF**

1. Open `/exams/simulator?paper=brevet-2024-demo`.
2. Answers that hit the barème (demo, no LLM key): `1-a` → `4`, `1-b` → `(x-2)(x-3)`, `2-a` → `8`, `2-b` → `3/8`, geometry `60` and `13`.
3. Submit. Marks per sub-question appear. **Download PDF report** hits `/api/exams/attempts/{id}/report`.
4. Teacher review: `/admin/exams`.

Gemini is used for grading only when `GEMINI_API_KEY` is set; otherwise the deterministic demo grader runs.

## 3) Streaks, XP, badges

- 🔥 **N Days Streak** on `/student` and `/profile` (calendar day in **Asia/Beirut**). Counts lesson views (`/lessons/interactive`) and AI solves.
- Monthly XP leaderboard: `/leaderboard`.
- Demo seed for Sara: Calculus Master, Probability Pro, Brevet Champ, 7-day streak.

## 4) Notification center

Header **bell** (unread badge + dropdown). Store: `notifications.json`.

Student seeds: video ready, live in 15 minutes, new official papers.  
Teacher seeds: live booked, exam submitted, AI solution issue (👎 on a solver result).

Live 15-minute in-app reminders also run when the bell fetches `/api/notifications` (bookings 10–20 minutes out).

## 5) Wallet & live-hour top-up

`/wallet` — (A) AI Platform Access Active/Expired + expiry date; (B) live class hours remaining.

- Demo top-up code: **`MUNZER-HRS-2H`** (adds 2 live hours). Also works on `/redeem`.
- Teacher generates codes: `/dashboard` → “أكواد شحن ساعات الحصص المباشرة”.
- Ledger of activations, top-ups, and booked live slots is on `/wallet`.

Staff: `teacher@mathmentor.local` / `demo-teacher`.

## Demo URLs

| Path | What |
| --- | --- |
| `/login` | Clean logo + form only |
| `/lessons/interactive` | Watermarked interactive lesson + streak XP |
| `/math-solver` | AI solver (demo engine without keys) |
| `/exams` | Official simulator hub |
| `/exams/simulator?paper=brevet-2024-demo` | Brevet paper |
| `/exams/simulator?paper=term-ls-2024-demo` | Terminale LS |
| `/leaderboard` | Monthly XP |
| `/profile` | Badges + streak |
| `/wallet` | Balances, devices, ledger, top-up modal |
| `/admin/exams` | Teacher submissions |
| `/dashboard` | Promo codes **and** live-hour top-up codes |
