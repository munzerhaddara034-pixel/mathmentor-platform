# MathMentor — Munzer Haddara Math Academy

منصة تعليم رياضيات للمنهج اللبناني وSAT: صف تفاعلي، اختبارات، بنك أسئلة، بطاقات تفعيل، ومساعد ذكاء اصطناعي يراجع الأستاذ المحتوى قبل نشره للطلاب.

A Lebanese-curriculum (and SAT) math academy: classroom videos, quizzes, a professor question bank, scratch-card entitlements, and an AI assistant whose drafts wait for professor approval.

هذا المستودع هو منصة MathMentor نفسها — ليست سوقاً جديداً ولا منتجاً آخر.

---

## المتطلبات / Prerequisites

- **Node.js 20** أو أحدث (Next.js 15 يحتاج 18.18+؛ نوصي بـ 20 LTS)
- npm (يأتي مع Node)

تحقق:

```bash
node -v
npm -v
```

---

## التشغيل / Run locally

من جذر المستودع (Mac, Linux, أو Windows):

```bash
npm install
cp .env.example .env.local   # اختياري — انظر المتغيرات أدناه
npm run dev
```

ثم افتح [http://localhost:3000](http://localhost:3000).

على Windows يمكنك أيضاً النقر مرتين على `start-platform.cmd`. على Mac/Linux:

```bash
chmod +x start-platform.sh
./start-platform.sh
```

لا تحتاج ويندوز لتشغيل المنصة.

### الإنتاج / Production build

```bash
npm run build
npm start
```

`npm start` يخدم البناء على المنفذ 3000 بعد `npm run build`.

---

## متغيرات البيئة / Environment variables

انسخ `.env.example` إلى `.env.local`. **لا تضع أسراراً في Git.**

| المتغير | مطلوب؟ | المعنى |
| --- | --- | --- |
| `OPENAI_API_KEY` | لا | مفتاح OpenAI لدردشة `/api/bot`. إن غاب، الردود محلية من قاعدة المعارف. |
| `OPENAI_MODEL` | لا | النموذج (الافتراضي `gpt-4o-mini`) |
| `NEXT_PUBLIC_VIDEO_PROVIDER` | لا | `local` (افتراضي) أو `bunny` / `vimeo-ott` / `wistia` |
| `NEXT_PUBLIC_BUNNY_LIBRARY_ID` | لا | مكتبة Bunny Stream |
| `NEXT_PUBLIC_VIMEO_OTT_URL` | لا | رابط تضمين Vimeo OTT |
| `NEXT_PUBLIC_WISTIA_ID` | لا | معرّف Wistia |

DRM الحقيقي يحتاج حساب CDN مدفوع. المشغّل المحلي يضع علامة مائية فقط.

---

## أول تشغيل والبيانات / First run and data

`data/store.json` **غير مضمّن في Git** (ملف تشغيلي محلي). عند أول `npm run dev` أو طلب API، المنصة تنشئه تلقائياً من البذرة في `src/lib/store.ts` و`src/lib/curriculum.ts`، وتشمل:

- كتالوج الكتب/النماذج اللبنانية
- درس الصف 12 علوم الحياة — النهايات (فصل 1)
- أكواد تجريبية: `MUNZER-GOLD-9A`، `MUNZER-G12-7K`، `BREVET-29-MX`

لا ترفع `.env` أو بطاقات حقيقية أو ملفات الطلاب.

---

## الصفحات / Pages

| المسار | المحتوى |
| --- | --- |
| `/` | الصفحة الرئيسية |
| `/classroom` | فيديوهات الصفوف |
| `/student` | دردشة الطالب ورفع صورة/ملف |
| `/practice` | تمارين واختبارات (MathJax) |
| `/quiz/[lessonId]` | اختبار الدرس |
| `/bank` | بنك أسئلة الأستاذ والامتحانات |
| `/professor` | المكتبة، التوليد، طابور الاعتماد |
| `/assistant` | موظف الذكاء الاصطناعي (نص أو صوت) |
| `/dashboard` | بطاقات الكشط / أكواد التفعيل |
| `/redeem` | تفعيل بطاقة الطالب |
| `/subscribe` | الرسوم وواتساب |
| `/leaderboard` | لوحة المتصدرين |
| `/resources` | ملخصات محمية (بدون تحميل PDF خام) |

هاتف الأكاديمية / واتساب للتجربة: **76532421** (`+961 76 532 421`).

---

## ملاحظات التجريب / Demo notes

- المنصة تعمل بدون `OPENAI_API_KEY` (ردود محلية).
- كود تجريبي كامل المنصة: `MUNZER-GOLD-9A` من صفحة `/redeem`.
- المحتوى المولَّد يبقى في طابور الأستاذ حتى الاعتماد.
- مجلدات `legacy/` و`legacy-source/` أرشيف للكود السابق وليست جزءاً من تطبيق Next.

---

## الترخيص والاستخدام

مشروع خاص بأكاديمية الأستاذ منذر حدارة. المحتوى الأكاديمي للمنصة وليس نسخاً حرفياً من كتب رسمية.
