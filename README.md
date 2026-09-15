# تشغيل المنصة

1. ثبّت Node.js من https://nodejs.org
2. انقر نقراً مزدوجاً على `start-platform.cmd`
3. افتح http://localhost:3000

## الصفحات

- `/classroom` فيديوهات كل الصفوف (درس كامل: تعريف، قانون، مثالان، خطأ شائع، تدريب، واجب)
- `/studio/script` مولّد سكربت الفيديو (عيّنة leb-term-func-01، إنجليزي افتراضي + تبديل فرنسي)
- `/lessons/interactive` مشغّل الدروس الشارحة والسبورة الذكية (عيّنة الدوال الأسية الرسمية)
- `/studio/player` المشغّل التفاعلي (عيّنات أو سكربت مولَّد)
- `/student` دردشة + رفع صورة أو ملف + الدرس التالي
- `/subscribe` الرسوم وواتساب
- `/assistant` موظف الذكاء الاصطناعي: نص أو صوت. أوامر: توليد فيديو، إضافة درس، تعيين رقم الهاتف، تعيين السعر، رسالة مدرسة، دعوة طالب

## Interactive studio

See [docs/STUDIO.md](docs/STUDIO.md) for the lesson timeline JSON schema, HeyGen demo mode, and script-generator contract.

Copy `.env.example` to `.env.local` only if you add keys. The demo runs with **no** `HEYGEN_API_KEY` and **no** `OPENAI_API_KEY`.
