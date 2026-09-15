import { academyLessons } from "./academyLessons";
import { defaultSettings } from "./settings";

export const assistantSystemPrompt = `أنت 'مساعد المنصة التعليمية للأستاذ منذر حدارة'. مهمتك إجابة الطلاب باللغة العربية بأسلوب مشجع، ودود، واحترافي. دورك يشمل: 1- الترحيب بالطلاب وتقديم الدعم الفني للمنصة. 2- الإجابة على الأسئلة الرياضية وتفسير طرق الحل بأسلوب خطوة بخطوة. 3- إرشاد الطلاب لشراء بطاقات الاشتراك والالتحاق بالدورات. إذا واجهتك مشكلة لا تعرف حلها، اطلب من الطالب ترك اسمه ورقم هاتفه ليتم التواصل معه من قِبل إدارة الأستاذ منذر.`;

export function knowledgeBase() {
  const lessons = academyLessons
    .slice(0, 20)
    .map((lesson) => `${lesson.gradeLabel} فصل ${lesson.chapter}: ${lesson.title} — ${lesson.idea} مثال: ${lesson.example} النتيجة: ${lesson.exampleBoard}`)
    .join("\n");
  return `
المنصة: Munzer Haddara Math Academy.
الأستاذ: منذر حدارة، أكاديمية رياضيات للشهادة اللبنانية وSAT.
الهاتف/واتساب: ${defaultSettings.phone} (76532421).
الاشتراك:
${defaultSettings.plans.map((plan) => `- ${plan.arabicName}: ${plan.usdMonthly}$ شهرياً أو ${plan.usdTerm}$ للفصل`).join("\n")}
التفعيل: واتساب أو بطاقة كشط من المكاتب المعتمدة في صفحة /redeem.
التسجيل: صفحة /subscribe ثم الصف /classroom ثم اختبار الدرس. الدرس التالي يُفتح بعد نجاح 70%.
الملفات: /resources للملخصات وأوراق العمل.
نسيت كلمة المرور: اطلب عبر واتساب 76532421 مع الاسم والصف.
مشاكل الفيديو: حدّث الصفحة، اسمح بالصوت، استخدم Chrome. الفيديو عليه علامة مائية باسم الطالب.
البث المباشر: يُعلن عبر واتساب والمنصة بعد موافقة الأستاذ.
المحتوى الأكاديمي (عيّنة):
${lessons}
`.trim();
}

export function botReply(question: string) {
  const q = question.toLowerCase();
  const kb = knowledgeBase();
  if (!question.trim()) {
    return "أهلاً بك في منصة الأستاذ منذر حدارة. كيف أساعدك: شرح درس، أسعار الاشتراك، بطاقة تفعيل، أو مشكلة تقنية؟";
  }
  if (q.includes("سعر") || q.includes("اشتراك") || q.includes("بطاق") || q.includes("price")) {
    return `أسعار المنصة:\n${defaultSettings.plans.map((p) => `• ${p.arabicName}: ${p.usdMonthly}$ / شهر`).join("\n")}\nللشراء واتساب ${defaultSettings.phone} أو أدخل رمز البطاقة في /redeem.`;
  }
  if (q.includes("واتس") || q.includes("هاتف") || q.includes("رقم")) {
    return `رقم المنصة: 76532421 أي ${defaultSettings.phone}. راسلنا على واتساب للتسجيل أو الدعم.`;
  }
  if (q.includes("كلمة") || q.includes("password") || q.includes("فيديو") || q.includes("تشغيل")) {
    return "إن نسيت كلمة المرور: راسل واتساب 76532421 باسمك وصفّك. إن لم يشتغل الفيديو: حدّث Chrome واضغط تشغيل الصوت. الفيديو محمي بعلامة مائية باسمك ورقم هاتفك.";
  }
  if (q.includes("تحميل") || q.includes("دوسي") || q.includes("pdf") || q.includes("ملخص")) {
    return "الملخصات وأوراق العمل في قسم المرفقات /resources. حلول الكتاب الأكاديمية تُعرض بعد الاشتراك وموافقة الأستاذ.";
  }
  const hit = academyLessons.find((lesson) => q.includes(lesson.title.toLowerCase()) || question.includes(lesson.arabicTitle) || q.includes(`ch${lesson.chapter}`));
  if (hit || q.includes("شرح") || q.includes("حل") || q.includes("نهاي") || q.includes("limit") || q.includes("معادل")) {
    const lesson = hit ?? academyLessons.find((item) => item.id === "grade-12-ch1")!;
    return `حسب محتوى الأستاذ منذر — ${lesson.gradeLabel} / ${lesson.title}:\n1) المعطى\n2) القانون: ${lesson.board}\n3) التنفيذ: ${lesson.example}\n4) الناتج: ${lesson.exampleBoard}\n5) تحقق بالتعويض.\nإذا أردت المزيد افتح الصف ثم اختبار الدرس. إن لم يكفِ اترك اسمك ورقم 76532… ليتم التواصل.`;
  }
  return `أنا مساعد منصة الأستاذ منذر حدارة.\n${kb.split("\n").slice(0, 8).join("\n")}\nسؤالك: «${question}». إن لم أستطع إغلاقه، اترك اسمك ورقم هاتفك (المنصة: 76532421) لإدارة الأستاذ.`;
}
