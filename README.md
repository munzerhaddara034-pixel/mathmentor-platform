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

**لكل درس** يمكن تعيين `videoUrl` على عنصر الدرس في `src/lib/academyLessons.ts` (انظر وحدة النهايات). المشغّل في `/classroom/[id]` يختار بالترتيب:

1. رابط يوتيوب (`youtube.com/watch` أو `youtu.be`) → تضمين
2. ملف مباشر: `/videos/....mp4` تحت `public/videos/`
3. Bunny / Vimeo / Wistia إذا كان الرابط من تلك الشبكات، أو عبر متغيرات البيئة أعلاه كاحتياطي عام
4. اللوح التفاعلي (storyboard) **فقط** إذا لم يوجد أي رابط — لا ندّعي أن الفيديو سُجّل

---

## وحدة النهايات التجريبية (صف 12 علوم الحياة)

المحتوى الجاهز للبيع في هذا الإصدار هو **النهايات**، مدخل باب الدوال (نهاية، استمرار، مشتقة):

| ماذا | أين |
| --- | --- |
| فيديو شرح حقيقي (حوالي 80 ثانية، أسلوب صف لا قائمة أهداف) | `public/videos/grade-12-ls-limits-intro.mp4` |
| ملخص عربي للطالب: أهداف، شرح، أمثلة، أخطاء | `/classroom/grade-12-ch1` و `/resources/print/grade-12-ch1` |
| بنك أسئلة النهايات (شريحة أولى داخل بنك الدوال، أكثر من 30 بنداً بأسلوب الامتحان) | `/practice/take?lessonId=grade-12-ch1` |
| مسابقة **علوم الحياة — الدوال** (دراسة الدوال = المسألة الرابعة في النموذج، 16 سؤالاً سهل→صعب) | `/practice` أو `/practice/take?bank=g12-ls-functions&mode=contest` |
| مسابقة **المتوسط — الهندسة** و**الجبر** (بنوك الشهادة المتوسطة) | `/practice` أو `/practice/take?bank=brevet-geometry&mode=contest` |
| نصوص منطوقة لثلاثة دروس (للتسجيل الحي لاحقاً) | `content/grade-12-ls-limits/` |

التدريب الحر لدرس النهايات يعرض شريحة النهايات. امتحان الدرس يسحب 12 سؤالاً بمزيج صعوبة. مسابقة الدوال تستخدم بنك الموضوع مرتّباً سهل→صعب (نهايات، استمرار، مشتقات، جدول تغيرات، تقارب، دالة عكسية).

لا توجد تسجيلات MP4 لباقي الصفوف بعد. الأستاذ يضع الملف أو رابط يوتيوب كما في القسم التالي.

---

## بنوك الشهادة حسب الموضوع

النماذج الرسمية على جهاز منذر (`LS all sessions.pdf`, `SE_All Sessions.pdf`, `GS-All.pdf`) **لا تُنسخ** إلى Git. يُستخرج أسلوب السؤال، ثم يُوزَّع على ملفات موضوع.

مسابقة **علوم الحياة** الرسمية غالباً أربع مسائل:

| المسألة | الموضوع | الملف |
| --- | --- | --- |
| أولاً | أسئلة مختلطة | لاحقاً |
| ثانياً | هندسة الفضاء | `content/banks/g12-ls/space-geometry.json` (لاحقاً) |
| ثالثاً | الاحتمالات | `content/banks/g12-ls/probability.json` (لاحقاً) |
| رابعاً | دراسة الدوال | `content/banks/g12-ls/functions.json` **(هذا الإصدار)** |

```
content/banks/g12-ls/functions.json         ← رابعاً · دراسة الدوال (الآن)
content/banks/g12-ls/space-geometry.json    ← ثانياً · لاحقاً
content/banks/g12-ls/probability.json       ← ثالثاً · لاحقاً
content/banks/g12-ls/integration.json       ← فصل إضافي لاحقاً
content/banks/brevet/geometry.json          ← هندسة البروفيه (الآن)
content/banks/brevet/algebra.json           ← جبر البروفيه (الآن)
content/banks/brevet/numbers.json           ← لاحقاً
content/banks/brevet/word_problems.json     ← لاحقاً
content/banks/brevet/coordinate.json        ← لاحقاً
content/banks/g12-se/…
content/banks/g12-gs/…
```

بنك **الدوال** يطابق المسألة الرابعة: حدود المجال (0 و +∞)، خطوط التقارب، جدول التغيرات، الدالة العكسية، المماس، جذر وحيد بحصار عددي. الشرائح: النهايات (مع فيديو الصف) ثم الاستمرار ثم المشتقات ثم جدول التغيرات ثم التقارب ثم العكسية. الملف مرتّب سهل → متوسط → صعب. البنود الأكاديمية تحمل `source.kind: generated-in-official-style` — **ليست** نماذج رسمية منسوخة.

**الشهادة المتوسطة (صف 9):** مسابقة بست أو سبع مسائل. البنوك: أعداد، جبر، مسائل لفظية، هندسة، هندسة تحليلية. المنفَّذ الآن **الهندسة** و**الجبر** (`content/banks/brevet/`). التفاصيل في `content/banks/brevet/README.md`.

كيف يُضاف الموضوع التالي من الورقة الرباعية (هندسة الفضاء ثم الاحتمالات): انسخ الملف، غيّر `id` والعناوين والشرائح، املأ الأسئلة بأسلوب الجلسات، ثم سجّله في `src/lib/topicBanks.ts`. التفاصيل في `content/banks/README.md`.

الطالب: `/practice` → مسابقة الدوال (صف 12) أو مسابقة الهندسة/الجبر (صف 9)، 16 سؤالاً سهل ثم متوسط ثم صعب، أو تدريب البنك كاملاً.

---

## كيف يضيف منذر فيديو مسجّلاً أو رابط يوتيوب

1. **يوتيوب:** انسخ رابط المشاهدة، ثم ضع `videoUrl: "https://www.youtube.com/watch?v=VIDEO_ID"` على الدرس في `src/lib/academyLessons.ts` (نفس الشكل المستخدم في درس النهايات).
2. **ملف MP4 من تصوير الصف:** احفظ الملف في `public/videos/` باسم واضح، مثلاً `grade-12-ls-continuity.mp4`، ثم:
   `videoUrl: "/videos/grade-12-ls-continuity.mp4"`
3. **Bunny / Vimeo / Wistia:** ضع رابط التضمين في `videoUrl`، أو اضبط متغيرات البيئة إذا كان البث عامّاً للمنصة.
4. أعد تشغيل `npm run dev`. صفحة الصف تشغّل الملف الحقيقي ولا تعود إلى اللوح إلا إذا حُذف الرابط.

لا تضع في Git ملفاً فارغاً وتسمّيه فيديو. إن لم يُسجَّل الدرس بعد، اترك `videoUrl` فارغاً حتى يظهر اللوح بوضوح كمسار مؤقت.

---

## خط إنتاج الدرس التالي (من فصل الكتاب إلى فيديو)

الهدف: نفس أسلوب الشرح في كل صف لاحقاً — افتتاح يطرح مسألة، فكرة واحدة، مثال محلول حتى النهاية، خطأ شائع، خلاصة قصيرة. **ممنوع** أن يكون الفيديو قراءة قائمة أهداف.

1. خذ فصل الكتاب (أهلية / CRDP) واكتب **نصاً منطوقاً** كما يتكلم الأستاذ على اللوح، لا مخطط نقاط. انظر النماذج:
   - `content/grade-12-ls-limits/01-intro-spoken-ar.md`
   - `content/grade-12-ls-limits/02-one-sided-infinity-spoken-ar.md`
   - `content/grade-12-ls-limits/03-indeterminate-squeeze-spoken-ar.md`
2. إن كان التصوير الحي جاهزاً: سجّل الدرس، ضع الـ MP4 في `public/videos/`، اربط `videoUrl` كما أعلاه. هذا هو المسار الأفضل.
3. إن لم يُسجَّل بعد وتريد مسودة شرح على اللوح (كالوحدة التجريبية): انسخ `content/grade-12-ls-limits/intro-video.json`، غيّر المشاهد (`hook` / `idea` / `example` / `mistake` / `recap`)، ثم:
   ```bash
   python3 -m pip install pillow arabic-reshaper
   python3 scripts/render-lesson-video.py content/grade-12-ls-limits/intro-video.json public/videos/YOUR-LESSON.mp4
   ```
   أو: `npm run video:limits` لإعادة توليد فيديو النهايات.
   العربية تُرسم من اليمين بعد `arabic_reshaper` فقط — لا تستخدم `python-bidi` بعد إعادة التشكيل (يعكس الحروف مرتين). اجعل سطور الرياضيات لاتينية والسطور العربية منفصلة حتى لا تنكسر الحروف.
4. اكتب الملخص العربي للطلاب (أهداف، شرح، أمثلة، أخطاء) وأضف 30+ سؤالاً **بمستوى الامتحان اللبناني** لا أسئلة مفردات. اربطها في `src/lib/quizBank.ts` كما في `grade12LsLimitsQuestions.ts`.
5. `npm run build` قبل الدمج.

Pillow وffmpeg مطلوبان لتوليد المسودة البرمجية فقط، وليسا من اعتمادات Next.

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
| `/classroom/grade-12-ch1` | وحدة النهايات (فيديو + ملخص عربي) |
| `/lessons/grade-12-ls-ch1` | نفس الوحدة من مسار الدروس |
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
