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

**لكل درس** يمكن تعيين `videoUrl` (English, default) و`videoUrlFr` في `src/lib/academyLessons.ts`. The classroom player shows a single **EN | FR** control: one click swaps the audio track and every on-screen board/caption together. Default is English.

المشغّل في `/classroom/[id]` و`/watch/[id]` يختار بالترتيب:

1. رابط يوتيوب (`youtube.com/watch` أو `youtu.be`) → تضمين
2. ملف مباشر: `/videos/....mp4` تحت `public/videos/` (English file on `videoUrl`, French file on `videoUrlFr`)
3. Bunny / Vimeo / Wistia إذا كان الرابط من تلك الشبكات، أو عبر متغيرات البيئة أعلاه كاحتياطي عام
4. اللوح التفاعلي (storyboard) **فقط** إذا لم يوجد أي رابط — لا ندّعي أن الفيديو سُجّل. The board fallback also follows EN | FR.

---

## Classroom videos (Professor Munzer)

Teaching language for the new explainers is **English** (spoken + board). Students switch to **French** with one EN | FR click: audio and on-screen writing change together. The teacher on camera is Professor Munzer (`public/teachers/munzer.jpg` plus teaching poses). Style is hook → one idea → worked example → common mistake → recap — not a bullet list of objectives.

| Lesson | Watch | Classroom | EN / FR files |
| --- | --- | --- | --- |
| Grade 12 LS · Continuity | `/lessons/grade-12-ls-continuity` · `/watch/grade-12-ch2` | `/classroom/grade-12-ch2` | `public/videos/grade-12-ls-continuity-en.mp4` / `-fr.mp4` |
| Grade 12 LS · Derivatives intro | `/lessons/grade-12-ls-derivatives` · `/watch/grade-12-ch3` | `/classroom/grade-12-ch3` | `public/videos/grade-12-ls-derivatives-en.mp4` / `-fr.mp4` |
| Brevet geometry · Thales | `/lessons/brevet-geometry` · `/watch/grade-9-ch4` | `/classroom/grade-9-ch4` | `public/videos/brevet-geometry-thales-en.mp4` / `-fr.mp4` |
| Grade 12 LS · Limits (earlier unit) | `/lessons/grade-12-ls-ch1` | `/classroom/grade-12-ch1` | `public/videos/grade-12-ls-limits-intro.mp4` |

Specs live in `content/lessons/*/video.json` so a later live recording can replace the mp4 without rewriting the player. Rebuild both languages with `npm run video:lessons`.

Index of wired videos: `/lessons`.

## وحدة النهايات التجريبية (صف 12 علوم الحياة)

المحتوى الجاهز يشمل **النهايات** ثم فيديوهات **الاستمرار** و**المشتقة** و**طاليس**:

| ماذا | أين |
| --- | --- |
| فيديو شرح حقيقي (حوالي 80 ثانية، أسلوب صف لا قائمة أهداف) | `public/videos/grade-12-ls-limits-intro.mp4` |
| ملخص عربي للطالب: أهداف، شرح، أمثلة، أخطاء | `/classroom/grade-12-ch1` و `/resources/print/grade-12-ch1` |
| بنك أسئلة النهايات (شريحة أولى داخل بنك الدوال، أكثر من 30 بنداً بأسلوب الامتحان) | `/practice/take?lessonId=grade-12-ch1` |
| مسابقة **علوم الحياة** — أسئلة مختلطة، هندسة الفضاء، الاحتمالات، الدوال | `/practice` أو `/practice/take?bank=g12-ls-functions&mode=contest` |
| مسابقة **اجتماع واقتصاد** — أسئلة مختلطة، احتمالات، دوال اقتصادية | `/practice` أو `/practice/take?bank=g12-se-functions&mode=contest` |
| مسابقة **علوم عامة** — أسئلة مختلطة، هندسة فضاء، احتمالات، أعداد مركبة، دوال | `/practice` أو `/practice/take?bank=g12-gs-functions&mode=contest` |
| مسابقة **المتوسط** — الأعداد، الجبر، المسائل اللفظية، الهندسة، الهندسة التحليلية | `/practice` أو `/practice/take?bank=brevet-numbers&mode=contest` |
| نصوص منطوقة لثلاثة دروس (للتسجيل الحي لاحقاً) | `content/grade-12-ls-limits/` |

---

## بنوك الشهادة حسب الموضوع

النماذج الرسمية على جهاز منذر (`LS all sessions.pdf`, `SE_All Sessions.pdf`, `GS-All.pdf`) **لا تُنسخ** إلى Git. يُستخرج أسلوب السؤال، ثم يُوزَّع على ملفات موضوع. البنود تحمل `source.kind: generated-in-official-style` — **ليست** نماذج رسمية منسوخة.

### علوم الحياة (LS)

| المسألة | الموضوع | الملف |
| --- | --- | --- |
| أولاً | أسئلة مختلطة | `content/banks/g12-ls/mcq-mixed.json` |
| ثانياً | هندسة الفضاء | `content/banks/g12-ls/space-geometry.json` |
| ثالثاً | الاحتمالات | `content/banks/g12-ls/probability.json` |
| رابعاً | دراسة الدوال | `content/banks/g12-ls/functions.json` |

### اجتماع واقتصاد (SE)

| المسألة | الموضوع | الملف |
| --- | --- | --- |
| أولاً | أسئلة مختلطة | `content/banks/g12-se/mcq-mixed.json` |
| ثانياً | الاحتمالات والإحصاء | `content/banks/g12-se/probability.json` |
| ثالثاً | الدوال والتحليل الاقتصادي | `content/banks/g12-se/functions.json` |

### علوم عامة (GS)

| المسألة | الموضوع | الملف |
| --- | --- | --- |
| أولاً | أسئلة مختلطة | `content/banks/g12-gs/mcq-mixed.json` |
| ثانياً | هندسة الفضاء | `content/banks/g12-gs/space-geometry.json` |
| ثالثاً | الاحتمالات | `content/banks/g12-gs/probability.json` |
| رابعاً | الأعداد المركبة | `content/banks/g12-gs/complex.json` |
| خامساً | دراسة الدوال | `content/banks/g12-gs/functions.json` |

### الشهادة المتوسطة (Brevet)

البنوك الخمسة جاهزة: أعداد، جبر، مسائل لفظية، هندسة، هندسة تحليلية (`content/banks/brevet/`). التفاصيل في `content/banks/brevet/README.md`.

```
content/banks/g12-ls/mcq-mixed.json
content/banks/g12-ls/space-geometry.json
content/banks/g12-ls/probability.json
content/banks/g12-ls/functions.json
content/banks/g12-se/mcq-mixed.json
content/banks/g12-se/probability.json
content/banks/g12-se/functions.json
content/banks/g12-gs/mcq-mixed.json
content/banks/g12-gs/space-geometry.json
content/banks/g12-gs/probability.json
content/banks/g12-gs/complex.json
content/banks/g12-gs/functions.json
content/banks/brevet/numbers.json
content/banks/brevet/algebra.json
content/banks/brevet/word_problems.json
content/banks/brevet/geometry.json
content/banks/brevet/coordinate.json
```

كيف يُضاف بنك موضوع جديد: انسخ ملفاً قائماً، غيّر `id` والعناوين والشرائح، املأ الأسئلة بأسلوب الجلسات، ثم سجّله في `src/lib/topicBanks.ts`. التفاصيل في `content/banks/README.md`.

الطالب: `/practice` → مسابقة الفرع (LS / SE / GS / Brevet)، 16 سؤالاً سهل ثم متوسط ثم صعب، أو تدريب البنك كاملاً.

---

## كيف يضيف منذر فيديو مسجّلاً أو رابط يوتيوب

1. **يوتيوب:** انسخ رابط المشاهدة، ثم ضع `videoUrl: "https://www.youtube.com/watch?v=VIDEO_ID"` على الدرس في `src/lib/academyLessons.ts` (نفس الشكل المستخدم في درس النهايات).
2. **ملف MP4 من تصوير الصف:** احفظ الملف الإنجليزي في `public/videos/` باسم واضح، مثلاً `grade-12-ls-continuity-en.mp4`، ثم:
   `videoUrl: "/videos/grade-12-ls-continuity-en.mp4"` and `videoUrlFr: "/videos/grade-12-ls-continuity-fr.mp4"`. The player default is English; FR swaps audio + board text together.
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
3. إن لم يُسجَّل بعد وتريد مسودة شرح على اللوح: انسخ `content/lessons/grade-12-ls-continuity/video.json`، اكتب `narration_en` / `narration_fr` و`caption_en` / `caption_fr` و`board_en` / `board_fr` (مشاهد `hook` / `idea` / `example` / `mistake` / `recap`)، ثم:
   ```bash
   python3 -m pip install pillow arabic-reshaper edge-tts
   python3 scripts/render-lesson-video.py content/lessons/YOUR-LESSON/video.json --both
   ```
   أو: `npm run video:lessons` لإعادة توليد الاستمرار والمشتقة وطاليس (EN+FR). `npm run video:limits` يعيد فيديو النهايات.
   Default teaching language is English. `--lang fr` (or `--both`) writes the French file with French TTS and French board text. Live sample recordings from the professor can replace the mp4 paths without changing the EN | FR player.
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
| `/lessons` | فهرس فيديوهات الشرح |
| `/lessons/grade-12-ls-ch1` | نفس وحدة النهايات |
| `/lessons/grade-12-ls-continuity` | الاستمرار — EN default, FR toggle |
| `/lessons/grade-12-ls-derivatives` | المشتقة — EN default, FR toggle |
| `/lessons/brevet-geometry` | طاليس / هندسة Brevet — EN default, FR toggle |
| `/watch/[id]` | مسار مشاهدة عام (مثلاً `/watch/grade-12-ch2`) |
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
