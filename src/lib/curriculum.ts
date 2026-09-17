import type { GradeTrack, LibraryItem } from "./types";

export const lebaneseCatalog: Array<Omit<LibraryItem, "id" | "createdAt" | "extractedText"> & { extractedText: string }> = [
  {
    title: "Mathematics — Intermediate Level, 9th year",
    kind: "book",
    track: "grade-9",
    subject: "رياضيات الشهادة المتوسطة",
    language: "ar",
    fileName: "grade9-brevet.pdf",
    notes: "مرجع CRDP للصف التاسع: الأعداد الحقيقية، الجبر، الدوال الخطية، طاليس، الإحصاء، المثلث القائم.",
    extractedText: `كتاب الصف التاسع اللبناني (Brevet)
الموضوعات: الأعداد الحقيقية والجبر، العبارات كثيرات الحدود، جمل الدرجة الأولى، طاليس والمثلثات المتشابهة، الدوال الخطية، الإحصاء، حساب المثلثات في المثلث القائم، هندسة الفضاء.
مثال درس: حل المعادلة 3x + 5 = 20 بطرح 5 ثم القسمة على 3، والتحقق بالتعويض.
مثال نموذج: إذا كان 2x + 7 = 19 فإن x = 6.`,
  },
  {
    title: "Mathematics — General and Life Sciences",
    kind: "book",
    track: "grade-12",
    subject: "علوم الحياة",
    language: "ar",
    fileName: "grade12-LS.pdf",
    notes: "كتاب الثانوية العامة — علوم الحياة: النهايات، المشتقات، التكامل، اللوغاريتم، الاحتمالات.",
    extractedText: `كتاب الصف الثاني عشر علوم الحياة
الموضوعات: النهايات والاستمرار، المشتقات، الدوال العكسية والمثلثية، المتجهات، الأعداد المركبة، التكامل، اللوغاريتم والأس، المعادلات التفاضلية، الإحصاء والعد، الاحتمالات، الجمل الخطية.
مثال: إذا كانت f(x)=x²+3x فإن f'(x)=2x+3 وبالتالي f'(2)=7.`,
  },
  {
    title: "نموذج امتحان شهادة متوسطة 01",
    kind: "exam-model",
    track: "grade-9",
    subject: "نموذج Brevet",
    language: "ar",
    fileName: "grade-9-certificate-model-1.pdf",
    notes: "نموذج محاكٍ لمهارات الشهادة المتوسطة وليس ورقة رسمية منسوخة.",
    extractedText: `نموذج الشهادة المتوسطة 01
1) 3x + 5 = 20. الحل: x = 5.
2) انشر 3(2x - 1). الحل: 6x - 3.
3) عدد زيد عليه 8 يساوي 23. أوجد العدد. الحل: 15.
4) متوسط 12 و15 و15 و18. الحل: 15.`,
  },
  {
    title: "Grade 12 Life Sciences · Model Exam 01",
    kind: "exam-model",
    track: "grade-12",
    subject: "علوم الحياة",
    language: "en",
    fileName: "grade-12-life-sciences-model-1.pdf",
    notes: "Original academy model aligned to Lebanese Grade 12 Life Sciences skills.",
    extractedText: `Grade 12 Life Sciences model 01
1) If f(x)=x^2+3x, find f'(2). Answer: 7.
2) Limits, derivatives, integration, logarithms, and probability practice items.`,
  },
];

export const trackLabel: Record<GradeTrack, { ar: string; en: string }> = {
  "grade-7": { ar: "حلقة ثالثة · صف 7", en: "EB7" },
  "grade-8": { ar: "حلقة ثالثة · صف 8", en: "EB8" },
  "grade-9": { ar: "شهادة متوسطة · صف 9", en: "Grade 9 Certificate" },
  "grade-11": { ar: "سنة أولى ثانوي · صف 11", en: "Secondary Year 1" },
  "grade-12": { ar: "شهادة ثانوية · صف 12", en: "Grade 12 Certificate" },
  sat: { ar: "رياضيات SAT", en: "SAT Math" },
};
