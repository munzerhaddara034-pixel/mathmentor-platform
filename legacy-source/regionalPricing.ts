export type PricingMarket = "lebanon" | "gulf";

export type RegionalPlan = {
  id: string;
  market: PricingMarket;
  name: string;
  nameAr: string;
  priceUsd: number;
  billing: "monthly";
  audience: string;
  includes: string[];
  includesAr: string[];
  paymentNote: string;
  status: "proposed";
};

/** Initial launch hypotheses for professor approval; not a completed charge or invoice. */
export const regionalPricingPlans: RegionalPlan[] = [
  { id: "lb-practice", market: "lebanon", name: "Certificate Practice", nameAr: "تدريب الشهادة", priceUsd: 8, billing: "monthly", audience: "Grade 9 or Grade 12 Certificate", includes: ["Core lessons", "Question bank", "Weekly progress view"], includesAr: ["الدروس الأساسية", "بنك الأسئلة", "متابعة أسبوعية للتقدم"], paymentNote: "Manual Whish Money verification", status: "proposed" },
  { id: "lb-guided", market: "lebanon", name: "Guided Certificate", nameAr: "الشهادة الموجّهة", priceUsd: 15, billing: "monthly", audience: "Grade 9 or Grade 12 Certificate", includes: ["Everything in Practice", "AI step-by-step tutor", "Homework support"], includesAr: ["كل ما في خطة التدريب", "مساعد ذكاء اصطناعي خطوة بخطوة", "مساعدة الواجب"], paymentNote: "Manual Whish Money verification", status: "proposed" },
  { id: "lb-intensive", market: "lebanon", name: "Certificate Intensive", nameAr: "الشهادة المكثفة", priceUsd: 25, billing: "monthly", audience: "Certificate learners needing extra sessions", includes: ["Everything in Guided", "Interactive-session eligibility", "Professor-reviewed follow-up"], includesAr: ["كل ما في الخطة الموجّهة", "أهلية الحصص التفاعلية", "متابعة يراجعها الأستاذ"], paymentNote: "Manual Whish Money verification", status: "proposed" },
  { id: "gulf-core", market: "gulf", name: "Gulf Core", nameAr: "الخليج الأساسية", priceUsd: 19, billing: "monthly", audience: "Middle and secondary mathematics", includes: ["Localized pathway", "Daily practice", "Bilingual student interface"], includesAr: ["مسار تعليمي محلي", "تدريب يومي", "واجهة طالب ثنائية اللغة"], paymentNote: "School or regional payment flow to confirm", status: "proposed" },
  { id: "gulf-certificate", market: "gulf", name: "Gulf Certificate", nameAr: "الخليج للشهادات", priceUsd: 39, billing: "monthly", audience: "Certificate and international-school learners", includes: ["Everything in Core", "AI tutor", "Mock exams and progress reports"], includesAr: ["كل ما في الأساسية", "مساعد الذكاء الاصطناعي", "اختبارات تجريبية وتقارير تقدم"], paymentNote: "School or regional payment flow to confirm", status: "proposed" },
  { id: "gulf-school", market: "gulf", name: "School Pilot", nameAr: "تجربة مدرسية", priceUsd: 12, billing: "monthly", audience: "Per learner, pilot cohort of 25+", includes: ["Admin review workspace", "Bilingual reporting", "Pilot onboarding support"], includesAr: ["مساحة مراجعة للإدارة", "تقارير ثنائية اللغة", "دعم بدء التجربة"], paymentNote: "Per-learner pilot quote; professor approval required", status: "proposed" },
];

export function getRegionalPlans(market: PricingMarket) {
  return regionalPricingPlans.filter((plan) => plan.market === market);
}

export function formatPlanPrice(plan: RegionalPlan) {
  return `$${plan.priceUsd}/month`;
}
