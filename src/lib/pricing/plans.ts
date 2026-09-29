/**
 * Multi-region subscription pricing for MathMentor.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never Al-Tarah / الطارة.
 * Updated: 2026-09-23 — ranges + defaultChargeUSD (midpoint) for checkout.
 */

import type { CurriculumFamily, CurriculumId } from "@/lib/curriculum/types";
import { getCurriculum } from "@/lib/curriculum/catalogs";

export type PricingRegion = "lebanon" | "gcc" | "international" | "admissions_us";

export type RegionalPlanId = "digitalCore" | "liveHybrid";

export type PaymentMethod = "whish" | "western_union" | "omt";

export type RegionalPlan = {
  id: RegionalPlanId;
  nameEn: string;
  nameAr: string;
  /** Inclusive USD band (display). */
  usdMonthlyMin: number;
  usdMonthlyMax: number;
  /** Checkout charge — midpoint of band (or fixed when min === max). */
  defaultChargeUSD: number;
  /** Alias of defaultChargeUSD for billing helpers. */
  usdMonthly: number;
  usdTerm: number;
  /** Optional SAR band hints for GCC display */
  sarMonthlyMin?: number;
  sarMonthlyMax?: number;
  badgeEn?: string;
  badgeAr?: string;
  featuresEn: string[];
  featuresAr: string[];
  tier: "AI_TIER" | "BOTH";
  liveCredits: number;
};

export type RegionalPricing = {
  region: PricingRegion;
  labelEn: string;
  labelAr: string;
  /** Short selector label (EN) */
  selectorEn: string;
  /** Short selector label (AR) */
  selectorAr: string;
  privateTutoringHourMinUsd: number;
  privateTutoringHourMaxUsd: number;
  /** Checkout default for private hour (midpoint). */
  privateTutoringHourUsd: number;
  notesEn?: string;
  notesAr?: string;
  plans: RegionalPlan[];
  /** Preferred default payment method for this region */
  defaultPaymentMethod: PaymentMethod;
};

function termFromMonthly(monthly: number): number {
  return Math.round(monthly * 2.5);
}

function planBand(
  id: RegionalPlanId,
  names: { nameEn: string; nameAr: string },
  band: { min: number; max: number; defaultCharge: number; sarMin?: number; sarMax?: number },
  opts: {
    featuresEn: string[];
    featuresAr: string[];
    tier: "AI_TIER" | "BOTH";
    liveCredits: number;
    badgeEn?: string;
    badgeAr?: string;
  },
): RegionalPlan {
  const usdMonthly = band.defaultCharge;
  return {
    id,
    nameEn: names.nameEn,
    nameAr: names.nameAr,
    usdMonthlyMin: band.min,
    usdMonthlyMax: band.max,
    defaultChargeUSD: band.defaultCharge,
    usdMonthly,
    usdTerm: termFromMonthly(usdMonthly),
    sarMonthlyMin: band.sarMin,
    sarMonthlyMax: band.sarMax,
    badgeEn: opts.badgeEn,
    badgeAr: opts.badgeAr,
    featuresEn: opts.featuresEn,
    featuresAr: opts.featuresAr,
    tier: opts.tier,
    liveCredits: opts.liveCredits,
  };
}

const DIGITAL_FEATURES_EN = [
  "Full digital platform access",
  "AI math solver with step-by-step help",
  "Interactive lessons & avatar explanations",
  "Exam models and practice sets",
  "Progress tracking for students & parents",
] as const;

const DIGITAL_FEATURES_AR = [
  "الوصول الكامل للمنصة الرقمية",
  "حلّال ذكاء اصطناعي خطوة بخطوة",
  "دروس تفاعلية وشروحات أفاتار",
  "نماذج امتحانات وتدريبات",
  "متابعة تقدّم الطالب وولي الأمر",
] as const;

const LIVE_FEATURES_EN_BASE = [
  "Everything in Digital Core",
  "4 live sessions / month with Prof. Munzer Haddara",
  "Booking credits for 1-on-1 live tutoring",
  "Priority WhatsApp academic support",
] as const;

const LIVE_FEATURES_AR_BASE = [
  "كل مزايا الباقة الرقمية الكاملة",
  "4 حصص لايف شهرياً مع الأستاذ منذر حداره",
  "أرصدة حجز للحصص المباشرة فردية",
  "دعم أكاديمي واتساب بأولوية",
] as const;

const DIGITAL_NAMES = {
  nameEn: "Full Digital Core",
  nameAr: "الباقة الرقمية الكاملة",
} as const;

const HYBRID_NAMES = {
  nameEn: "Platform + 4 live sessions",
  nameAr: "منصة + 4 حصص لايف",
} as const;

export const REGIONAL_PRICING: Record<PricingRegion, RegionalPricing> = {
  lebanon: {
    region: "lebanon",
    labelEn: "Lebanon",
    labelAr: "لبنان",
    selectorEn: "Lebanon",
    selectorAr: "لبنان",
    privateTutoringHourMinUsd: 25,
    privateTutoringHourMaxUsd: 25,
    privateTutoringHourUsd: 25,
    notesEn: "Lebanon official curriculum (Brevet / Terminale).",
    notesAr: "المنهج اللبناني الرسمي (المتوسطة / الثانوية).",
    defaultPaymentMethod: "whish",
    plans: [
      planBand("digitalCore", DIGITAL_NAMES, { min: 15, max: 15, defaultCharge: 15 }, {
        featuresEn: [...DIGITAL_FEATURES_EN],
        featuresAr: [...DIGITAL_FEATURES_AR],
        tier: "AI_TIER",
        liveCredits: 0,
      }),
      planBand("liveHybrid", HYBRID_NAMES, { min: 35, max: 35, defaultCharge: 35 }, {
        badgeEn: "Most requested",
        badgeAr: "الأكثر طلباً",
        featuresEn: [...LIVE_FEATURES_EN_BASE],
        featuresAr: [...LIVE_FEATURES_AR_BASE],
        tier: "BOTH",
        liveCredits: 4,
      }),
    ],
  },
  gcc: {
    region: "gcc",
    labelEn: "GCC",
    labelAr: "دول الخليج",
    selectorEn: "GCC",
    selectorAr: "الخليج",
    privateTutoringHourMinUsd: 50,
    privateTutoringHourMaxUsd: 50,
    privateTutoringHourUsd: 50,
    notesEn:
      "Government curricula & secondary tracks (SA, AE, QA, KW): Qudurat, Tahsili, and ministry-approved pathways. Checkout uses fixed midpoint USD (Digital $42 · Hybrid $110 · Private $50/hr); SAR figures are approximate.",
    notesAr:
      "تشمل اختبارات القدرات والتحصيلي ومسارات الثانوي ومناهج الوزارة المعتمدة.",
    defaultPaymentMethod: "western_union",
    plans: [
      planBand(
        "digitalCore",
        DIGITAL_NAMES,
        { min: 42, max: 42, defaultCharge: 42, sarMin: 130, sarMax: 190 },
        {
          featuresEn: [
            ...DIGITAL_FEATURES_EN,
            "Qudurat & Tahsili aligned practice tracks",
            "Ministry-approved secondary pathways (SA / AE / QA / KW)",
          ],
          featuresAr: [
            ...DIGITAL_FEATURES_AR,
            "مسارات تدرّب متوافقة مع القدرات والتحصيلي",
            "مسارات الثانوي ومناهج الوزارة المعتمدة (السعودية / الإمارات / قطر / الكويت)",
          ],
          tier: "AI_TIER",
          liveCredits: 0,
        },
      ),
      planBand(
        "liveHybrid",
        HYBRID_NAMES,
        { min: 110, max: 110, defaultCharge: 110, sarMin: 340, sarMax: 490 },
        {
          badgeEn: "Includes Qudurat & Tahsili",
          badgeAr: "شامل القدرات والتحصيلي",
          featuresEn: [
            ...LIVE_FEATURES_EN_BASE,
            "Qudurat & Tahsili coaching focus",
            "Ministry-aligned secondary tracks",
          ],
          featuresAr: [
            ...LIVE_FEATURES_AR_BASE,
            "تركيز تدريبي على القدرات والتحصيلي",
            "مسارات ثانوي متوافقة مع مناهج الوزارة",
          ],
          tier: "BOTH",
          liveCredits: 4,
        },
      ),
    ],
  },
  international: {
    region: "international",
    labelEn: "International (IB / Cambridge)",
    labelAr: "دولي (IB / Cambridge)",
    selectorEn: "International (IB/Cambridge)",
    selectorAr: "دولي (IB/Cambridge)",
    privateTutoringHourMinUsd: 70,
    privateTutoringHourMaxUsd: 100,
    privateTutoringHourUsd: 85,
    notesEn:
      "IB DP Math HL/SL and Cambridge IGCSE/A-Level — KaTeX-precise notation and academic rigor valued worldwide (Gulf & beyond).",
    notesAr:
      "IB DP Math HL/SL وCambridge IGCSE/A-Level — دقة أكاديمية مع KaTeX داخل الخليج والعالم.",
    defaultPaymentMethod: "western_union",
    plans: [
      planBand("digitalCore", DIGITAL_NAMES, { min: 60, max: 85, defaultCharge: 72 }, {
        featuresEn: [
          ...DIGITAL_FEATURES_EN,
          "IB DP Math HL/SL & Cambridge IGCSE/A-Level pathways",
          "KaTeX-precise math formatting for academic rigor",
        ],
        featuresAr: [
          ...DIGITAL_FEATURES_AR,
          "مسارات IB DP Math HL/SL وCambridge IGCSE/A-Level",
          "تنسيق رياضي دقيق بـ KaTeX للقيمة الأكاديمية",
        ],
        tier: "AI_TIER",
        liveCredits: 0,
      }),
      planBand("liveHybrid", HYBRID_NAMES, { min: 150, max: 220, defaultCharge: 185 }, {
        badgeEn: "Elite Preparation",
        badgeAr: "Elite Preparation",
        featuresEn: [
          ...LIVE_FEATURES_EN_BASE,
          "Elite IB / Cambridge exam preparation with Prof. Munzer Haddara",
          "Academic precision with KaTeX-ready explanations",
        ],
        featuresAr: [
          ...LIVE_FEATURES_AR_BASE,
          "تحضير نخبوي لـ IB / Cambridge مع الأستاذ منذر حداره",
          "دقة أكاديمية وشروحات جاهزة لـ KaTeX",
        ],
        tier: "BOTH",
        liveCredits: 4,
      }),
    ],
  },
  admissions_us: {
    region: "admissions_us",
    labelEn: "US Admissions (SAT / ACT / AP)",
    labelAr: "قبول أمريكي (SAT / ACT / AP)",
    selectorEn: "US Admissions (SAT/ACT/AP)",
    selectorAr: "قبول أمريكي (SAT/ACT/AP)",
    privateTutoringHourMinUsd: 50,
    privateTutoringHourMaxUsd: 75,
    privateTutoringHourUsd: 62,
    notesEn:
      "SAT / ACT Math and AP Calculus — intensive speed, strategies, and math justification.",
    notesAr:
      "رياضيات SAT / ACT وAP Calculus — سرعة مكثّفة واستراتيجيات وتبرير رياضي.",
    defaultPaymentMethod: "western_union",
    plans: [
      planBand("digitalCore", DIGITAL_NAMES, { min: 45, max: 65, defaultCharge: 55 }, {
        featuresEn: [
          ...DIGITAL_FEATURES_EN,
          "SAT / ACT Math & AP Calculus practice tracks",
          "Intensive speed, strategies, and math justification",
        ],
        featuresAr: [
          ...DIGITAL_FEATURES_AR,
          "مسارات SAT / ACT Math وAP Calculus",
          "سرعة مكثّفة واستراتيجيات وتبرير رياضي",
        ],
        tier: "AI_TIER",
        liveCredits: 0,
      }),
      planBand("liveHybrid", HYBRID_NAMES, { min: 110, max: 160, defaultCharge: 135 }, {
        badgeEn: "Admissions boost",
        badgeAr: "دفعة قبول",
        featuresEn: [
          ...LIVE_FEATURES_EN_BASE,
          "SAT / ACT / AP coaching with Prof. Munzer Haddara",
          "Timed drills, strategies, and justification practice",
        ],
        featuresAr: [
          ...LIVE_FEATURES_AR_BASE,
          "تدريب SAT / ACT / AP مع الأستاذ منذر حداره",
          "تدريبات موقوتة واستراتيجيات وتبرير رياضي",
        ],
        tier: "BOTH",
        liveCredits: 4,
      }),
    ],
  },
};

export const PRICING_REGIONS: PricingRegion[] = [
  "lebanon",
  "gcc",
  "international",
  "admissions_us",
];

export const PAYMENT_METHODS: PaymentMethod[] = ["whish", "western_union", "omt"];

export function isPricingRegion(value: unknown): value is PricingRegion {
  return (
    value === "lebanon" ||
    value === "gcc" ||
    value === "international" ||
    value === "admissions_us"
  );
}

export function isRegionalPlanId(value: unknown): value is RegionalPlanId {
  return value === "digitalCore" || value === "liveHybrid";
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "whish" || value === "western_union" || value === "omt";
}

export function pricingRegionFromCurriculumFamily(family: CurriculumFamily): PricingRegion {
  if (family === "lebanese") return "lebanon";
  if (family === "gcc") return "gcc";
  if (family === "ap" || family === "sat_act") return "admissions_us";
  // ib / cambridge
  return "international";
}

export function pricingRegionFromCurriculumId(curriculumId: CurriculumId): PricingRegion {
  return pricingRegionFromCurriculumFamily(getCurriculum(curriculumId).family);
}

export function getRegionalPricing(region: PricingRegion): RegionalPricing {
  return REGIONAL_PRICING[region];
}

export function getRegionalPlan(region: PricingRegion, planId: RegionalPlanId): RegionalPlan {
  const pack = REGIONAL_PRICING[region];
  const plan = pack.plans.find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown regional plan ${planId} for ${region}`);
  }
  return plan;
}

/** True when card should lead with a USD range (international / admissions_us). GCC & Lebanon are fixed. */
export function planShowsPriceBand(plan: RegionalPlan): boolean {
  return plan.usdMonthlyMin !== plan.usdMonthlyMax;
}

export function formatUsdBand(min: number, max: number): string {
  if (min === max) return `$${min}`;
  return `$${min}–${max}`;
}

export function formatRegionalPrice(plan: RegionalPlan, period: "monthly" | "term"): string {
  if (period === "term") {
    return `$${plan.usdTerm}`;
  }
  const band = formatUsdBand(plan.usdMonthlyMin, plan.usdMonthlyMax);
  if (plan.sarMonthlyMin != null && plan.sarMonthlyMax != null) {
    if (plan.sarMonthlyMin === plan.sarMonthlyMax) {
      return `${band} ≈ ${plan.sarMonthlyMin} SAR`;
    }
    return `${band} ≈ ${plan.sarMonthlyMin}–${plan.sarMonthlyMax} SAR`;
  }
  return band;
}

export function formatPrivateHourBand(pack: RegionalPricing): string {
  return formatUsdBand(pack.privateTutoringHourMinUsd, pack.privateTutoringHourMaxUsd);
}
