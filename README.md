# تشغيل المنصة

1. ثبّت Node.js من https://nodejs.org
2. انقر نقراً مزدوجاً على `start-platform.cmd`
3. افتح http://localhost:3000

## الصفحات

- `/classroom` فيديوهات كل الصفوف (درس كامل: تعريف، قانون، مثالان، خطأ شائع، تدريب، واجب)
- `/studio/script` مولّد سكربت الفيديو (عيّنة leb-term-func-01، إنجليزي افتراضي + تبديل فرنسي)
- `/admin/video-generator` مولّد فيديو HeyGen (سكربت، ملاحظات، أمثلة، لغة الصوت، السرعة)
- `/math-solver` حلّال الذكاء (نص، لاتكس، صورة) ثم شرح تفاعلي
- `/lessons/interactive-explanation` مشغّل الفيديو والسبورة لزمن حل المسألة
- `/live` حجز حصة مباشرة مع الأستاذ منذر حداره
- `/admin` سجلات الذكاء وطلبات الحصص المباشرة
- `/studio/player` المشغّل التفاعلي (عيّنات أو سكربت مولَّد أو `?job=` بعد HeyGen)
- `/student` دردشة + رفع صورة أو ملف + الدرس التالي
- `/subscribe` الرسوم وواتساب
- `/assistant` موظف الذكاء الاصطناعي: نص أو صوت. أوامر: توليد فيديو، إضافة درس، تعيين رقم الهاتف، تعيين السعر، رسالة مدرسة، دعوة طالب

## Interactive studio

See [docs/STUDIO.md](docs/STUDIO.md) for the lesson timeline JSON schema, HeyGen demo mode, and script-generator contract. HeyGen request fields and the teacher workflow are in [docs/HEYGEN.md](docs/HEYGEN.md). AI solver + dual-tier live sessions: [docs/AI_SOLVER.md](docs/AI_SOLVER.md).

Copy `.env.example` to `.env.local` only if you add keys. The demo runs with **no** `HEYGEN_API_KEY` and **no** `OPENAI_API_KEY`. Daily path: write script → `/admin/video-generator` → webhook/status → students watch the sync player.

## Auth, promo unlock, and demo accounts

Interactive lessons and studio routes are **private**. See [docs/AUTH.md](./docs/AUTH.md).

| Account | Password | Access |
| --- | --- | --- |
| `student@mathmentor.local` | `demo-student` | AI + Live (4 credits) |
| `ai@mathmentor.local` | `demo-ai` | Solver + lessons |
| `live@mathmentor.local` | `demo-live` | Live booking only |
| `pending@mathmentor.local` | `demo-pending` | Login only → `/redeem` |
| `parent@mathmentor.local` | `demo-parent` | Lessons + solver |
| `teacher@mathmentor.local` | `demo-teacher` | Studio + lessons |
| `admin@mathmentor.local` | `demo-admin` | Studio + lessons |

Promo card for local unlock: `MUNZER-GOLD-9A` (AI), `MUNZER-LIVE-4C` (live), `MUNZER-BOTH-1X` (bundle) on `/redeem` (must be signed in). A second login on the same account kicks the first device.
