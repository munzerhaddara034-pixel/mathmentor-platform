import type { CurriculumId, CurriculumTerminology } from "./types";

const LEBANESE: CurriculumTerminology = {
  derivative: { en: "Derivative", ar: "المشتقة / التفاضل" },
  limits: { en: "Limits", ar: "النهايات" },
  domain: { en: "Domain of definition D_f", ar: "مجموعة التعريف D_f" },
  integral: { en: "Integral", ar: "التكامل" },
  asymptote: { en: "Asymptote", ar: "المستقيم المقارب" },
  variationTable: { en: "Table of variations", ar: "جدول التغيرات" },
  finalAnswer: { en: "Boxed final answer", ar: "الجواب النهائي في إطار" },
  showThat: { en: "Show that", ar: "بيّن أن" },
};

const SAT: CurriculumTerminology = {
  derivative: { en: "Derivative / rate of change", ar: "المشتقة / معدّل التغيّر" },
  limits: { en: "Limits (advanced)", ar: "النهايات (متقدم)" },
  domain: { en: "Domain / valid inputs", ar: "مجال التعريف" },
  integral: { en: "Integral (advanced)", ar: "التكامل (متقدم)" },
  asymptote: { en: "Asymptote", ar: "مقارب" },
  variationTable: { en: "Sign / monotonicity chart", ar: "إشارة / رتابة" },
  finalAnswer: { en: "Grid-in / selected answer", ar: "الجواب (اختيار أو شبكة)" },
  showThat: { en: "Which of the following", ar: "أيّ ممّا يلي" },
};

const GCC: CurriculumTerminology = {
  derivative: { en: "Derivative", ar: "المشتقة" },
  limits: { en: "Limits", ar: "النهايات" },
  domain: { en: "Domain", ar: "مجال الدالة" },
  integral: { en: "Integral", ar: "التكامل" },
  asymptote: { en: "Asymptote", ar: "خط التقارب" },
  variationTable: { en: "Increasing / decreasing", ar: "التزايد والتناقص" },
  finalAnswer: { en: "Final answer", ar: "الإجابة النهائية" },
  showThat: { en: "Prove that", ar: "أثبت أن" },
};

const IB: CurriculumTerminology = {
  derivative: { en: "Differentiation", ar: "التفاضل" },
  limits: { en: "Limits", ar: "النهايات" },
  domain: { en: "Domain / range", ar: "المجال والمدى" },
  integral: { en: "Integration", ar: "التكامل" },
  asymptote: { en: "Asymptote", ar: "المقارب" },
  variationTable: { en: "Sign diagram", ar: "مخطط الإشارة" },
  finalAnswer: { en: "Exact value / GDC", ar: "قيمة دقيقة / آلة بيانية" },
  showThat: { en: "Show that", ar: "بيّن أن" },
};

const CAMBRIDGE: CurriculumTerminology = {
  derivative: { en: "Differentiation", ar: "التفاضل" },
  limits: { en: "Limits", ar: "النهايات" },
  domain: { en: "Domain", ar: "المجال" },
  integral: { en: "Integration", ar: "التكامل" },
  asymptote: { en: "Asymptote", ar: "المقارب" },
  variationTable: { en: "Stationary points", ar: "نقاط الاستقرار" },
  finalAnswer: { en: "Hence / exact answer", ar: "ومن ثمّ / جواب دقيق" },
  showThat: { en: "Show that", ar: "أثبت أن" },
};

const AP: CurriculumTerminology = {
  derivative: { en: "Derivative", ar: "المشتقة" },
  limits: { en: "Limits", ar: "النهايات" },
  domain: { en: "Domain", ar: "المجال" },
  integral: { en: "Integral / FTC", ar: "التكامل / المبرهنة الأساسية" },
  asymptote: { en: "Asymptote", ar: "المقارب" },
  variationTable: { en: "First / second derivative test", ar: "اختبار المشتقة الأولى/الثانية" },
  finalAnswer: { en: "AP free-response answer", ar: "جواب FRQ" },
  showThat: { en: "Justify", ar: "علّل" },
};

const BY_ID: Record<CurriculumId, CurriculumTerminology> = {
  lebanese: LEBANESE,
  "saudi-gcc": GCC,
  ib: IB,
  cambridge: CAMBRIDGE,
  ap: AP,
  sat: SAT,
};

export function terminologyFor(curriculumId: CurriculumId): CurriculumTerminology {
  return BY_ID[curriculumId] ?? LEBANESE;
}
