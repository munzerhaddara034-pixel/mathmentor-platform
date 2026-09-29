# Retention modules (anti-sharing, exams, streaks, alerts, wallet)

Instructor: **Prof. Munzer Haddara** / **الأستاذ منذر حداره**. Branding: **MathMentor · أكاديمية منذر حداره**. Never Al-Tarah / الطارة.

JSON stores (`auth.json`, notifications, exam attempts, …) use **Netlify Blobs** (`mathmentor-data`) on Netlify/Lambda and the project `data/` folder for local `next dev`. See [AUTH.md](./AUTH.md). Binary uploads may still use `/tmp` on Lambda.

No extra env vars are required (`@netlify/blobs` is zero-config on Netlify). Demo accounts stay in [AUTH.md](./AUTH.md) (not on `/login`).

Sign in as `student@mathmentor.local` / `demo-student` unless noted.

## 1) Anti-account sharing

- Fingerprint hash: `userAgent + screen + timezone + localStorage mm_device_id`.
- **Students:** concurrent sessions **1 mobile + 1 desktop** per account. A second login of the *same class* invalidates the previous device of that class (`/login?reason=replaced`). One phone **and** one computer may stay signed in together.
- **Teacher / admin** (`teacher`, `admin`, including `teacher@mathmentor.local`): **not kicked**. Other devices stay signed in. Each staff login writes an in-app alert «جهاز جديد نشط / New active device» with the User-Agent device name (e.g. Windows Chrome, iPhone Safari) and Asia/Beirut time. See the header bell and `/dashboard` → **أجهزتي النشطة / Active devices**.

**How to test the student kick**

1. Sign in on Chrome (desktop) as `student@mathmentor.local`. Open `/lessons/interactive`.
2. In DevTools → Application → Local Storage set `mm_qa_device_class` to `desktop` (already desktop) **or** open a second desktop browser profile and sign in with the same account. The first session is closed on the next navigation.
3. To keep both classes: in one browser set `mm_qa_device_class` = `mobile`, in the other leave it unset (desktop). Both sessions stay.
4. Watermark on video players, `/lessons/interactive`, `/math-solver/result/…`, and `/lessons/interactive-explanation`: drifting `[Name] - [Phone] - [DD/MM/YYYY]` (Asia/Beirut date). Sara Nassar · 76111111.

**How to test the teacher exemption**

1. Sign in as `teacher@mathmentor.local` / `demo-teacher` on a desktop.
2. Sign in again from a second desktop profile (do not set `mm_qa_device_class`). The first session stays valid.
3. Open `/dashboard`: the new device is listed and the bell shows «جهاز جديد نشط / New active device» with the device name.

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
Teacher device logins also push «جهاز جديد نشط / New active device» (not seeded; created on each staff sign-in).

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
| `/dashboard` | Promo codes, live-hour top-ups, **active teacher devices** and device-login alerts |
