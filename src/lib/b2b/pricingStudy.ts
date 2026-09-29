/**
 * Official B2B / retail pricing study for MathMentor.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره — never الطارة.
 * Numbers are exact product policy; keep UI in sync with this module.
 * Updated: 2026-09-23 — Gulf B2B schools $12–18 / student / mo, min 40.
 */

export type PricingStudyId =
  | "digital_basic"
  | "gold"
  | "schools_b2b"
  | "one_on_one"
  | "semi_private";

export type PricingStudyRow = {
  id: PricingStudyId;
  nameEn: string;
  nameAr: string;
  audienceEn: string;
  audienceAr: string;
  priceEn: string;
  priceAr: string;
  /** Machine-readable USD bands for proposals / ops. */
  usd: {
    monthlyMin?: number;
    monthlyMax?: number;
    schoolYear?: number;
    perStudentMonthlyMin?: number;
    perStudentMonthlyMax?: number;
    minStudents?: number;
    hourlyMin?: number;
    hourlyMax?: number;
    groupSizeMin?: number;
    groupSizeMax?: number;
  };
  includesEn: string[];
  includesAr: string[];
};

export const PRICING_STUDY: PricingStudyRow[] = [
  {
    id: "digital_basic",
    nameEn: "Digital Basic",
    nameAr: "الأساسي الرقمي",
    audienceEn: "Brevet / Terminale",
    audienceAr: "المتوسطة / الثانوية",
    priceEn: "$10–15 / month or $75 / school year",
    priceAr: "١٠–١٥$ شهرياً أو ٧٥$ للسنة الدراسية",
    usd: { monthlyMin: 10, monthlyMax: 15, schoolYear: 75 },
    includesEn: [
      "Unlimited interactive lessons",
      "AI math solver",
      "Official exam simulators + Barème",
      "Printed assistant / worksheets",
    ],
    includesAr: [
      "دروس تفاعلية بلا حدود",
      "حلّال الرياضيات بالذكاء الاصطناعي",
      "محاكاة امتحانات رسمية + السلّم (Barème)",
      "مساعد مطبوعات / أوراق عمل",
    ],
  },
  {
    id: "gold",
    nameEn: "Gold",
    nameAr: "ذهبي",
    audienceEn: "Intensive platform track",
    audienceAr: "مسار مكثّف للمنصة",
    priceEn: "$25–35 / month",
    priceAr: "٢٥–٣٥$ شهرياً",
    usd: { monthlyMin: 25, monthlyMax: 35 },
    includesEn: ["Full platform access", "4 group live sessions / month"],
    includesAr: ["الوصول الكامل للمنصة", "٤ حصص مباشرة جماعية / شهر"],
  },
  {
    id: "schools_b2b",
    nameEn: "Schools B2B (Gulf)",
    nameAr: "مدارس الخليج (B2B)",
    audienceEn: "Gulf private schools",
    audienceAr: "مدارس خاصة في الخليج",
    priceEn: "$12–18 / student / month (min 40 students)",
    priceAr: "١٢–١٨$ للطالب / شهر (حد أدنى ٤٠ طالباً)",
    usd: {
      perStudentMonthlyMin: 12,
      perStudentMonthlyMax: 18,
      minStudents: 40,
    },
    includesEn: [
      "School dashboard + teacher training",
      "School-wide exam review sessions",
      "Term / annual school budget contracts",
      "Class accounts for enrolled students",
    ],
    includesAr: [
      "لوحة المدرسة + تدريب المعلمين",
      "جلسات مراجعة امتحانات على مستوى المدرسة",
      "عقود ميزانية مدرسية فصلية / سنوية",
      "حسابات صفوف للطلاب المسجّلين",
    ],
  },
  {
    id: "one_on_one",
    nameEn: "1-on-1 in-person",
    nameAr: "فردي حضوري",
    audienceEn: "Private intensive · by area",
    audienceAr: "خاص مكثّف · حسب المنطقة",
    priceEn: "$15–25 / hour by area",
    priceAr: "١٥–٢٥$ / ساعة حسب المنطقة",
    usd: { hourlyMin: 15, hourlyMax: 25 },
    includesEn: ["Barème step-by-step corrections"],
    includesAr: ["تصحيح وفق السلّم خطوة بخطوة"],
  },
  {
    id: "semi_private",
    nameEn: "Semi-private groups",
    nameAr: "مجموعات شبه خاصة",
    audienceEn: "4–6 students",
    audienceAr: "٤–٦ طلاب",
    priceEn: "$5–8 / student / hour",
    priceAr: "٥–٨$ للطالب / ساعة",
    usd: {
      hourlyMin: 5,
      hourlyMax: 8,
      groupSizeMin: 4,
      groupSizeMax: 6,
    },
    includesEn: ["Board papers", "Free platform homework account"],
    includesAr: ["أوراق لوح / تمارين", "حساب منصة للواجبات مجاناً"],
  },
];

export function pricingStudyById(id: PricingStudyId): PricingStudyRow | undefined {
  return PRICING_STUDY.find((row) => row.id === id);
}

/** Suggest a B2B school quote from student count (mid-band, min 40). */
export function schoolB2bQuote(studentCount: number): {
  students: number;
  perStudent: number;
  monthlyTotal: number;
  yearlyTotal: number;
} {
  const row = pricingStudyById("schools_b2b")!;
  const min = row.usd.minStudents ?? 40;
  const students = Math.max(min, Math.round(studentCount) || min);
  const perStudent =
    ((row.usd.perStudentMonthlyMin ?? 12) + (row.usd.perStudentMonthlyMax ?? 18)) / 2;
  const monthlyTotal = Math.round(students * perStudent * 100) / 100;
  return {
    students,
    perStudent,
    monthlyTotal,
    yearlyTotal: Math.round(monthlyTotal * 10 * 100) / 100, // ~school year (10 months)
  };
}
