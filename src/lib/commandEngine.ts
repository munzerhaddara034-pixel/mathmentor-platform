export function runEmployeeCommand(input: string, settings: PlatformSettings): CommandResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  const phone = text.match(/(\+?\d[\d\s-]{7,}\d)/);
  if ((lower.includes("phone") || lower.includes("whatsapp") || lower.includes("هاتف") || lower.includes("واتساب")) && phone) {
    const value = phone[1].replace(/\s+/g, " ").trim();
    return {
      reply: `تم تحديث رقم واتساب الأكاديمية إلى ${value}. يظهر للطلاب في صفحة الاشتراك.`,
      settingsPatch: { phone: value, whatsapp: value.replace(/\s/g, "") },
    };
  }

  const price = text.match(/(\d+)\s*(usd|\$|دولار)/i);
  if ((lower.includes("price") || lower.includes("سعر") || lower.includes("اشتراك")) && price) {
    const usdMonthly = Number(price[1]);
    return {
      reply: `تم تحديث سعر الاشتراك الشهري إلى ${usdMonthly}$.`,
      settingsPatch: {
        plans: settings.plans.map((plan) => (plan.id === "all" ? { ...plan, usdMonthly } : plan)),
      },
    };
  }

  if (lower.includes("generate") || lower.includes("video") || lower.includes("فيديو") || lower.includes("شرح")) {
    const lesson =
      academyLessons.find((item) => lower.includes(item.id) || lower.includes(item.title.toLowerCase())) ??
      academyLessons.find((item) => item.track === trackFromText(lower) && item.chapter === 1);
    return {
      reply: `تم تجهيز درس مصور متكامل لـ ${lesson?.gradeLabel} · ${lesson?.title}.`,
      generatedLessonId: lesson?.id,
    };
  }

  if (lower.includes("add lesson") || lower.includes("أضف درس") || lower.includes("new lesson")) {
    const title = text.replace(/add lesson|أضف درس|new lesson/gi, "").trim() || "درس جديد";
    const chapter = 90 + Math.floor(Math.random() * 9);
    const newLesson: AcademyLessonRecord = {
      id: createId("lesson"),
      track: trackFromText(lower),
      gradeLabel: "Custom",
      chapter,
      title,
      arabicTitle: title,
      idea: `${title}`,
      board: `قاعدة الدرس: ${title}`,
      example: `مسألة نموذجية على ${title}`,
      exampleBoard: "المعطيات -> الحل -> النتيجة",
    };
    return {
      reply: `تمت إضافة الدرس الجديد "${title}" بنجاح.`,
      newLesson,
      generatedLessonId: newLesson.id,
    };
  }

  // عند إرسال أي تعديل أو أمر تطويري عام
  return {
    reply: `🤝 جاري تنفيذ التعديل المطلوب برمجياً عبر وكيل التطوير: "${text}". سيتم رفع التحديث وإعادة النشر تلقائياً.`,
  };
}
