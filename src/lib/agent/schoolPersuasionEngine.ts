/**
 * School B2B persuasion engine — Lebanon / GCC / International.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره
 * Whish wallet for Lebanon stays 96170772968 — never invent parallel payment phones.
 */

import { INSTRUCTOR_AR, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";

export type PersuasionRegion = "lebanon" | "gcc" | "international";

export type ObjectionKey =
  | "too_expensive"
  | "teachers_resist_ai"
  | "data_privacy"
  | "already_have_lms"
  | "results_unproven";

export type PersuasionPack = {
  region: PersuasionRegion;
  regionLabelAr: string;
  regionLabelEn: string;
  valuePillars: string[];
  valuePillarsAr: string[];
  roiBullets: string[];
  roiBulletsAr: string[];
  outreachLetterAr: string;
  outreachLetterEn: string;
  pitchDeckOutline: string[];
  whatsappScriptAr: string;
  whatsappScriptEn: string;
  objections: Record<ObjectionKey, { objection: string; replyAr: string; replyEn: string }>;
};

const ROI_SHARED_AR = [
  "توفير ١٥+ ساعة أسبوعياً على تصحيح الواجبات والتحضير.",
  "خفض تكلفة الدعم العلاجي بنحو ٤٠٪ عبر مسارات سقراطية موجّهة.",
  "تقارير امتثال لأولياء الأمور والإدارة جاهزة بنقرة.",
];

const ROI_SHARED_EN = [
  "15+ teacher hours/week saved on grading & prep.",
  "~40% remedial cost cut via guided Socratic loops.",
  "One-click compliance reports for parents & leadership.",
];

function objectionsFor(region: PersuasionRegion): PersuasionPack["objections"] {
  return {
    too_expensive: {
      objection: "Too expensive / غالي",
      replyAr:
        "نقارن التكلفة بساعات التصحيح الأسبوعية: ١٥ ساعة × أجر المعلّم تتجاوز اشتراك المدرسة خلال أسابيع. تجربة فصل واحد كافية لإثبات العائد.",
      replyEn:
        "Compare to 15 grading hours/week — payback often within weeks. Start with one pilot class.",
    },
    teachers_resist_ai: {
      objection: "Teachers resist AI",
      replyAr:
        "المنصّة مساعدة للأستاذ لا بديل عنه — باريم لبناني / Cambridge / IB بإشراف بشري. الواجهة باسم الأستاذ منذر حداره، ليست روبوتاً مجهولاً.",
      replyEn:
        "AI assists teachers; humans stay in control. Branded as Prof. Munzer Haddara — not a faceless bot.",
    },
    data_privacy: {
      objection: "Data privacy",
      replyAr:
        "بيانات الطلاب تُخزَّن ضمن حساب المدرسة؛ لا بيع لطرف ثالث. تقارير مجمّعة للإدارة فقط.",
      replyEn:
        "School-scoped storage; no third-party sale. Leadership sees aggregates only.",
    },
    already_have_lms: {
      objection: "We already have an LMS",
      replyAr:
        "MathMentor يكمل الـ LMS: حل رياضي بصري + باريم + حصص لايف — وليس مجرد رفع ملفات.",
      replyEn:
        "We complement your LMS with visual math, Barème/IB marking, and live tutoring — not file upload alone.",
    },
    results_unproven: {
      objection: "Unproven results",
      replyAr:
        region === "lebanon"
          ? "نقدّم تقرير أخطاء باريم (نهايات، مقاربات، مشتقات) من عيّنة تجريبية قبل التعاقد السنوي."
          : "Pilot report on weak topics (SAT/IB/Cambridge) before annual commit.",
      replyEn:
        "Pilot weak-topic report before annual commitment — Lebanon Barème or SAT/IB/Cambridge tracks.",
    },
  };
}

export function buildPersuasionPack(region: PersuasionRegion): PersuasionPack {
  if (region === "lebanon") {
    return {
      region,
      regionLabelAr: "لبنان · المنهج الرسمي / الباريم",
      regionLabelEn: "Lebanon · Official curriculum / Barème",
      valuePillars: [
        "Lebanese Barème-aligned grading hints",
        "Homework auto-assist with teacher override",
        "Calculus / limits / asymptotes pitfall drills",
      ],
      valuePillarsAr: [
        "تلميحات تصحيح وفق الباريم اللبناني",
        "مساعدة واجبات مع إشراف المعلّم",
        "تمارين مطبات النهايات والمقاربات والمشتقات",
      ],
      roiBullets: ROI_SHARED_EN,
      roiBulletsAr: ROI_SHARED_AR,
      outreachLetterAr: [
        `السلام عليكم،`,
        `أنا ${INSTRUCTOR_AR} من MathMentor.`,
        `نقدّم للثانويات اللبنانية منصّة تُحاكي منطق الباريم في النهايات والمقاربات والمشتقات، مع توفير ١٥+ ساعة أسبوعياً على التصحيح وخفض التكلفة العلاجية بنحو ٤٠٪.`,
        `نقترح تجربة صف واحد لمدّة أسبوعين مع تقرير أخطاء باريم مجاني.`,
        `للتواصل والدفع المحلي عبر Whish: 96170772968 باسم منذر أحمد حداره.`,
      ].join("\n"),
      outreachLetterEn: [
        `Greetings,`,
        `I am ${INSTRUCTOR_EN} of MathMentor.`,
        `We help Lebanese secondary schools with Barème-aligned practice (limits, asymptotes, derivatives), saving 15+ teacher hours/week and cutting remedial cost ~40%.`,
        `We propose a two-week single-class pilot with a free Barème-mistake report.`,
        `Lebanon transfers via Whish 96170772968 (Munzer Ahmad Haddara).`,
      ].join("\n"),
      pitchDeckOutline: [
        "1. Problem: Barème pitfalls drain teacher time",
        "2. Solution: Munzer-branded AI + live hybrid",
        "3. ROI: 15h/week · ~40% remedial cut",
        "4. Pilot plan + Whish payment",
        "5. Compliance & privacy",
      ],
      whatsappScriptAr: [
        `مرحباً إدارة المدرسة، ${INSTRUCTOR_AR} من MathMentor.`,
        `هل نستعرض خلال ١٠ دقائق كيف نوفّر ١٥ ساعة تصحيح أسبوعياً مع تقارير باريم؟`,
        `تجربة صف واحد مجانية للتقرير.`,
      ].join("\n"),
      whatsappScriptEn: [
        `Hello — ${INSTRUCTOR_EN}, MathMentor.`,
        `Can we show in 10 minutes how to save 15 grading hours/week with Barème reports?`,
        `One-class pilot available.`,
      ].join("\n"),
      objections: objectionsFor("lebanon"),
    };
  }

  if (region === "gcc") {
    return {
      region,
      regionLabelAr: "الخليج · Cambridge / IB / قدرات وتحصيلي",
      regionLabelEn: "GCC · Cambridge / IB / Qudrat & Tahsili",
      valuePillars: [
        "Cambridge / IB / SAT-style pathways",
        "Socratic AI tutor in AR/EN",
        "Ministry-friendly compliance digests",
      ],
      valuePillarsAr: [
        "مسارات Cambridge / IB / SAT",
        "معلّم سقراطي بالعربي والإنجليزي",
        "تقارير امتثال مناسبة للإدارة",
      ],
      roiBullets: ROI_SHARED_EN,
      roiBulletsAr: ROI_SHARED_AR,
      outreachLetterAr: [
        `تحية طيبة،`,
        `${INSTRUCTOR_AR} — MathMentor للمدارس الخليجية.`,
        `نقود مسارات Cambridge/IB والقدرات مع ذكاء سقراطي وتقارير أسبوعية لأولياء الأمور، مع توفير ١٥+ ساعة للمعلّمين.`,
        `نقترح ورشة تعريفية عن بُعد لمدة ٢٠ دقيقة.`,
      ].join("\n"),
      outreachLetterEn: [
        `Dear leadership,`,
        `${INSTRUCTOR_EN} — MathMentor for GCC schools.`,
        `Cambridge/IB/Qudrat tracks with Socratic AI and weekly parent digests — 15+ teacher hours saved.`,
        `We offer a 20-minute remote intro workshop.`,
      ].join("\n"),
      pitchDeckOutline: [
        "1. GCC exam pressure & teacher load",
        "2. Multi-curriculum engine (Cambridge/IB/SAT)",
        "3. Socratic AI + live hybrid",
        "4. ROI & pilot",
        "5. Compliance reports",
      ],
      whatsappScriptAr: [
        `أهلاً، ${INSTRUCTOR_AR} من MathMentor.`,
        `نساعد مدارس الخليج على قدرات/IB مع توفير وقت المعلّمين — هل نحدد مكالمة قصيرة؟`,
      ].join("\n"),
      whatsappScriptEn: [
        `Hello — ${INSTRUCTOR_EN}, MathMentor.`,
        `We help GCC schools on Qudrat/IB while saving teacher time — short call?`,
      ].join("\n"),
      objections: objectionsFor("gcc"),
    };
  }

  // international
  return {
    region: "international",
    regionLabelAr: "دولي · IB / Cambridge / SAT",
    regionLabelEn: "International · IB / Cambridge / SAT",
    valuePillars: [
      "IB / Cambridge / SAT rigor with visual proofs",
      "Socratic hint loops (not answer dumps)",
      "Board-ready analytics for international schools",
    ],
    valuePillarsAr: [
      "صرامة IB / Cambridge / SAT مع براهين بصرية",
      "حلقات تلميح سقراطية (لا إجابات جاهزة)",
      "تحليلات جاهزة لمجالس المدارس الدولية",
    ],
    roiBullets: ROI_SHARED_EN,
    roiBulletsAr: ROI_SHARED_AR,
    outreachLetterAr: [
      `Hello,`,
      `${INSTRUCTOR_AR} / ${INSTRUCTOR_EN} — MathMentor.`,
      `We deliver IB/Cambridge/SAT prep with Socratic AI, cutting remedial spend ~40% and freeing 15+ teacher hours weekly.`,
      `Happy to share a board one-pager and pilot syllabus.`,
    ].join("\n"),
    outreachLetterEn: [
      `Hello,`,
      `${INSTRUCTOR_EN} — MathMentor.`,
      `IB/Cambridge/SAT prep with Socratic AI — ~40% remedial cut, 15+ teacher hours/week freed.`,
      `Board one-pager + pilot syllabus available.`,
    ].join("\n"),
    pitchDeckOutline: [
      "1. International math outcomes gap",
      "2. Socratic AI + Munzer pedagogy",
      "3. Curriculum coverage matrix",
      "4. ROI",
      "5. Pilot & success metrics",
    ],
    whatsappScriptAr: [
      `مرحباً — ${INSTRUCTOR_AR}، MathMentor للمدارس الدولية.`,
      `هل نشارك ملخّص مجلس إدارة عن توفير ١٥ ساعة أسبوعياً؟`,
    ].join("\n"),
    whatsappScriptEn: [
      `Hello — ${INSTRUCTOR_EN}, MathMentor for international schools.`,
      `Share a board brief on saving 15 teacher hours/week?`,
    ].join("\n"),
    objections: objectionsFor("international"),
  };
}

export function handleObjection(
  region: PersuasionRegion,
  key: ObjectionKey,
): { replyAr: string; replyEn: string; objection: string } {
  const pack = buildPersuasionPack(region);
  return pack.objections[key];
}

export function parsePersuasionRegion(raw: unknown): PersuasionRegion {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "gcc" || s === "gulf" || s.includes("خليج")) return "gcc";
  if (s === "international" || s === "intl" || s.includes("دولي")) return "international";
  return "lebanon";
}
