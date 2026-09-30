# /admin/team — دردشة الفريق + تخزين Postgres

## 1. التخزين الدائم (Postgres / Neon)
- عند وجود `DATABASE_URL` تُخزَّن **كل** بيانات المنصة في Postgres: الحسابات والجلسات (`auth.json`)، ملفات الطلاب (`mm_profile_users` / `mm_enrollments` / `mm_lesson_progress` / `mm_exam_reminders`)، سجلّ المحلّل وتدقيق الأستاذ (`mm_ai_queries`)، وكل مخازن JSON الأخرى (الحجوزات، الإشعارات، Agent Hub/السكرتير، الفوترة…) كصفوف في `mm_documents`.
- بدون `DATABASE_URL` يعمل كل شيء كما قبل (ملفات `data/` + SQLite)، ويبقى Netlify Blobs مدعوماً.
- الترحيلات (migrations) idempotent وتعمل تلقائياً عند الإقلاع (`src/instrumentation.ts`) مع advisory lock. يدوياً: `npm run db:migrate` (أو `npm run db:migrate -- --import-files` لاستيراد ملفات `data/` الحالية مرة واحدة).
- عند أول قراءة لمفتاح غير موجود في Postgres يُستورد ملف `data/<key>` المحلي إن وُجد (عطّلها بـ `PG_IMPORT_LOCAL_FILES=0`).
- أخطاء Postgres لا تُخفى ولا يحدث رجوع صامت إلى الملفات.

## 2. دردشة الفريق
- الصفحة: `/admin/team` (أستاذ/إدارة فقط). القنوات: الفريق كله · محمد · سامي · المبرمج.
- البرومبتات الثلاثة حرفياً من `docs/TEAM_CHAT_SPEC.md` §1 (`src/lib/team/prompts.ts`).
- التوجيه (§2): المذكور بالاسم يردّ؛ وإلا حسب الموضوع؛ عند الغموض محمد وحده؛ إحالة واحدة كحد أقصى لكل وكيل؛ حد أقصى 3 ردود لكل رسالة بشرية.
- محمد: مواعيد/تذكيرات تُسجَّل فعلياً في جدول السكرتير (Agent Hub) عبر كتلة `mm-actions`؛ الموجز اليومي من بيانات حيّة؛ الرياضيات بـ KaTeX + فقرة «التحقق».
- سامي: مقترحات + prompt؛ يولّد معاينة (Gemini image أو OpenAI) إن توفّرت حصة، وإلا تنبيه واضح. لا نشر أبداً.
- المبرمج: يقرأ ملفات المستودع ← يقترح Diff (حد 4 ملفات / 600 سطر) ← فحوص (أسرار، any/@ts-ignore، مسارات، صياغة TS) ← بطاقة «موافقة ونشر» / «رفض».
  - **الـ Commit يحدث فقط بضغط إنسان على «موافقة ونشر» + تأكيد** (`src/lib/team/approval.ts`). الموافقة النصية لا تنفّذ شيئاً.
  - الافتراضي: فرع ميزة `feat/…` من `GITHUB_BRANCH`. `main`/`master` ممنوعان كلياً. الفرع الحيّ يحتاج كتابة اسمه حرفياً.
  - Render لا يشغّل `tsc`/`build` قبل الـ Commit — لذلك الافتراضي فرع ميزة يُراجَع ويُدمَج يدوياً.
- الأسرار الملصقة في الدردشة تُحجب قبل التخزين وقبل إرسالها للنموذج، مع تنبيه تدوير.
- الصوت: زر الميكروفون يفرّغ الصوت (Whisper/Gemini) إلى خانة الكتابة. المرفقات: صور/PDF/صوت/نص حتى 8MB × 4.

## 3. متغيرات Render
| المتغير | إلزامي | الوصف |
|---|---|---|
| `DATABASE_URL` | نعم (للتخزين الدائم) | Neon: `postgres://…/db?sslmode=require` |
| `GEMINI_API_KEY` | نعم | ردود الوكلاء الثلاثة |
| `GITHUB_TOKEN` | لـ Commit المبرمج | صلاحية contents:write على المستودع |
| `GITHUB_OWNER` / `GITHUB_REPO` | لـ Commit المبرمج | المستودع |
| `GITHUB_BRANCH` | اختياري | الفرع الأساسي (افتراضي `agent-hub-latest`) |
| `OPENAI_API_KEY` | اختياري | Whisper + صور سامي |
| `TEAM_GEMINI_MODEL` | اختياري | نموذج مفضّل (مع سلسلة بدائل تلقائية) |
| `TEAM_APPROVER_EMAILS` | اختياري | حصر زر الموافقة بإيميلات محددة |
| `SAMI_IMAGE_GEN=off` / `SAMI_IMAGE_PROVIDER=openai` / `SAMI_IMAGE_MODEL` | اختياري | توليد الصور |
| `PG_POOL_MAX` / `PG_IMPORT_LOCAL_FILES=0` | اختياري | حجم الـ pool / تعطيل الاستيراد |

## 4. الاختبار
- `npx tsx scripts/test-team-chat.ts` (ملفات) و`DATABASE_URL=… npx tsx scripts/test-team-chat.ts` (Postgres) — نموذج وهمي، بلا GITHUB_TOKEN.
- `DATABASE_URL=… npx tsx scripts/verify-postgres-storage.ts` — يتأكد أن لا شيء يُكتب في `data/`.
- تحذير: اختبار Postgres يكتب رسائل اختبار؛ شغّله على قاعدة غير الإنتاج.
