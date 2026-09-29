import type { CurriculumDefinition, CurriculumId } from "./types";
import { DEFAULT_CURRICULUM_ID } from "./types";

const lebanese: CurriculumDefinition = {
  id: "lebanese",
  family: "lebanese",
  labelEn: "Lebanese",
  labelAr: "لبناني",
  shortEn: "LB",
  shortAr: "لبنان",
  descriptionEn:
    "Official Lebanese path: Brevet (Grade 9) and Terminale GS | LS | SE | LH with CRDP-aligned pedagogy.",
  descriptionAr:
    "المنهاج اللبناني الرسمي: الشهادة المتوسطة والثانوية العامة (علوم عامة | علوم حياة | اجتماع واقتصاد | إنسانيات).",
  contentPhase: "default",
  defaultLanguage: "ar",
  defaultTrackId: "terminale-ls",
  grades: [
    { id: "eb7", labelEn: "EB7 · Grade 7", labelAr: "حلقة ثالثة · صف 7", code: "EB7" },
    { id: "eb8", labelEn: "EB8 · Grade 8", labelAr: "حلقة ثالثة · صف 8", code: "EB8" },
    { id: "brevet", labelEn: "Brevet · Grade 9", labelAr: "شهادة متوسطة · صف 9", code: "Brevet" },
    { id: "s1", labelEn: "Secondary Year 1", labelAr: "سنة أولى ثانوي", code: "S1" },
    { id: "s2", labelEn: "Secondary Year 2", labelAr: "سنة ثانية ثانوي", code: "S2" },
    { id: "terminale", labelEn: "Terminale · Grade 12", labelAr: "شهادة ثانوية · صف 12", code: "T" },
  ],
  tracks: [
    { id: "brevet", labelEn: "Brevet", labelAr: "متوسطة", examTrack: "brevet", solverTrack: "brevet" },
    { id: "gs", labelEn: "Terminale GS", labelAr: "علوم عامة", examTrack: "terminale-gs", solverTrack: "gs" },
    { id: "ls", labelEn: "Terminale LS", labelAr: "علوم حياة", examTrack: "terminale-ls", solverTrack: "ls" },
    { id: "se", labelEn: "Terminale SE", labelAr: "اجتماع واقتصاد", examTrack: "terminale-se", solverTrack: "se" },
    { id: "lh", labelEn: "Terminale LH", labelAr: "إنسانيات", solverTrack: "lh" },
  ],
  examArchives: [
    {
      id: "brevet-archive",
      labelEn: "Brevet archive",
      labelAr: "أرشيف المتوسطة",
      sessions: ["June", "September"],
    },
    {
      id: "terminale-archive",
      labelEn: "Terminale archive",
      labelAr: "أرشيف الثانوية",
      sessions: ["June ordinary", "September"],
    },
  ],
  samples: [
    {
      id: "lb-limits-ls",
      titleEn: "Limits & asymptotes (LS)",
      titleAr: "النهايات والمستقيمات المقاربة (علوم حياة)",
      objectiveEn: "Write D_f, evaluate boundary limits, and name asymptote equations.",
      objectiveAr: "كتابة مجموعة التعريف وحساب النهايات عند الأطراف وكتابة معادلات المستقيمات المقاربة.",
      prerequisiteEn: "Algebraic simplification and indeterminate forms ∞/∞, 0/0.",
      prerequisiteAr: "التبسيط الجبري والصيغ غير المعيّنة ∞/∞ و 0/0.",
      samplePromptEn: "Study lim x→∞ of (2x²+1)/(x²-4). Write the horizontal asymptote.",
      samplePromptAr: "ادرس نهاية (2x²+1)/(x²-4) عندما x→∞. اكتب المستقيم المقارب الأفقي.",
      sampleLatex: "\\lim\\limits_{x \\to +\\infty} \\frac{2x^{2}+1}{x^{2}-4}",
    },
  ],
};

const saudiGcc: CurriculumDefinition = {
  id: "saudi-gcc",
  family: "gcc",
  labelEn: "Saudi / GCC",
  labelAr: "سعودي / خليجي",
  shortEn: "GCC",
  shortAr: "خليج",
  descriptionEn:
    "GCC umbrella: Saudi Mawhiba, Qudurat, Tahsili, MoE tracks; UAE EmSAT; Qatar & Kuwait MoE samples.",
  descriptionAr:
    "مظلة الخليج: موهبة وقدرات وتحصيلي ووزارة التعليم السعودية، إمسات الإمارات، وعينات قطر والكويت.",
  contentPhase: "sample",
  defaultLanguage: "ar",
  defaultTrackId: "qudurat",
  grades: [
    { id: "sec1", labelEn: "Secondary 1", labelAr: "أول ثانوي" },
    { id: "sec2", labelEn: "Secondary 2", labelAr: "ثاني ثانوي" },
    { id: "sec3", labelEn: "Secondary 3", labelAr: "ثالث ثانوي" },
  ],
  tracks: [
    { id: "mawhiba", labelEn: "Mawhiba", labelAr: "موهبة" },
    { id: "qudurat", labelEn: "Qudurat", labelAr: "قدرات" },
    { id: "tahsili", labelEn: "Tahsili", labelAr: "تحصيلي" },
    { id: "moe-sa", labelEn: "Saudi MoE", labelAr: "وزارة التعليم" },
    { id: "emsat", labelEn: "UAE EmSAT", labelAr: "إمسات" },
    { id: "qatar", labelEn: "Qatar MoE", labelAr: "قطر" },
    { id: "kuwait", labelEn: "Kuwait MoE", labelAr: "الكويت" },
  ],
  examArchives: [
    { id: "qudurat-archive", labelEn: "Qudurat practice", labelAr: "تدريب قدرات" },
    { id: "tahsili-archive", labelEn: "Tahsili practice", labelAr: "تدريب تحصيلي" },
    { id: "emsat-archive", labelEn: "EmSAT Math", labelAr: "إمسات رياضيات" },
  ],
  samples: [
    {
      id: "gcc-qudurat-ratio",
      titleEn: "Qudurat quantitative sample",
      titleAr: "عيّنة قدرات كمية",
      objectiveEn: "Solve a quantitative comparison / ratio problem under timed Qudurat style.",
      objectiveAr: "حل مسألة مقارنة كمية أو نسبة بأسلوب قدرات الموقوت.",
      prerequisiteEn: "Fractions, percentages, and proportional reasoning.",
      prerequisiteAr: "الكسور والنسب المئوية والتناسب.",
      samplePromptEn: "If 3/5 of a number is 24, what is 5/8 of the same number?",
      samplePromptAr: "إذا كان 3/5 عددٍ يساوي 24، فما قيمة 5/8 من العدد نفسه؟",
      sampleLatex: "\\frac{3}{5}n=24\\quad\\Rightarrow\\quad \\frac{5}{8}n=?",
    },
  ],
};

const ib: CurriculumDefinition = {
  id: "ib",
  family: "ib",
  labelEn: "IB",
  labelAr: "البكالوريا الدولية",
  shortEn: "IB",
  shortAr: "IB",
  descriptionEn: "IB Mathematics Analysis & Approaches (AA) and Applications & Interpretation (AI), SL/HL.",
  descriptionAr: "رياضيات البكالوريا الدولية: التحليل والنهج (AA) والتطبيقات والتفسير (AI)، المستوى العادي والعالي.",
  contentPhase: "sample",
  defaultLanguage: "en",
  defaultTrackId: "aa-hl",
  grades: [
    { id: "dp1", labelEn: "DP Year 1", labelAr: "سنة دبلوم 1" },
    { id: "dp2", labelEn: "DP Year 2", labelAr: "سنة دبلوم 2" },
  ],
  tracks: [
    { id: "aa-sl", labelEn: "AA SL", labelAr: "AA عادي" },
    { id: "aa-hl", labelEn: "AA HL", labelAr: "AA عالي" },
    { id: "ai-sl", labelEn: "AI SL", labelAr: "AI عادي" },
    { id: "ai-hl", labelEn: "AI HL", labelAr: "AI عالي" },
  ],
  examArchives: [
    { id: "ib-paper1", labelEn: "Paper 1 (no GDC / limited)", labelAr: "ورقة 1" },
    { id: "ib-paper2", labelEn: "Paper 2", labelAr: "ورقة 2" },
  ],
  samples: [
    {
      id: "ib-aa-diff",
      titleEn: "AA differentiation sample",
      titleAr: "عيّنة تفاضل AA",
      objectiveEn: "Differentiate a composite function and state the domain of the derivative.",
      objectiveAr: "اشتقاق دالة مركّبة وتحديد مجال المشتقة.",
      prerequisiteEn: "Chain rule and natural logarithm.",
      prerequisiteAr: "قاعدة السلسلة واللوغاريتم الطبيعي.",
      samplePromptEn: "Find f'(x) if f(x)=ln(x²+1). State the domain of f'.",
      samplePromptAr: "أوجد f'(x) إذا كانت f(x)=ln(x²+1). عيّن مجال f'.",
      sampleLatex: "f(x)=\\ln(x^{2}+1)",
    },
  ],
};

const cambridge: CurriculumDefinition = {
  id: "cambridge",
  family: "cambridge",
  labelEn: "Cambridge",
  labelAr: "كامبريدج",
  shortEn: "CIE",
  shortAr: "كامبردج",
  descriptionEn: "Cambridge IGCSE Mathematics and AS/A-Level Mathematics (planned full library).",
  descriptionAr: "رياضيات كامبريدج IGCSE ومستوى AS/A (مكتبة كاملة في مراحل لاحقة).",
  contentPhase: "planned",
  defaultLanguage: "en",
  defaultTrackId: "igcse",
  grades: [
    { id: "igcse", labelEn: "IGCSE", labelAr: "IGCSE" },
    { id: "as", labelEn: "AS Level", labelAr: "AS" },
    { id: "a2", labelEn: "A Level", labelAr: "A-Level" },
  ],
  tracks: [
    { id: "igcse", labelEn: "IGCSE", labelAr: "IGCSE" },
    { id: "as-pure", labelEn: "AS Pure", labelAr: "بحث بحت AS" },
    { id: "a-level", labelEn: "A-Level", labelAr: "A-Level" },
  ],
  examArchives: [
    { id: "cie-past", labelEn: "Past papers (phased)", labelAr: "أوراق سابقة (مراحل)" },
  ],
  samples: [],
};

const ap: CurriculumDefinition = {
  id: "ap",
  family: "ap",
  labelEn: "AP Calculus",
  labelAr: "AP تفاضل وتكامل",
  shortEn: "AP",
  shortAr: "AP",
  descriptionEn: "AP Calculus AB / BC foundations (phased content).",
  descriptionAr: "أساسات AP Calculus AB / BC (محتوى على مراحل).",
  contentPhase: "planned",
  defaultLanguage: "en",
  defaultTrackId: "ab",
  grades: [
    { id: "ab", labelEn: "AP Calculus AB", labelAr: "AP AB" },
    { id: "bc", labelEn: "AP Calculus BC", labelAr: "AP BC" },
  ],
  tracks: [
    { id: "ab", labelEn: "AB", labelAr: "AB" },
    { id: "bc", labelEn: "BC", labelAr: "BC" },
  ],
  examArchives: [
    { id: "ap-frq", labelEn: "FRQ practice (phased)", labelAr: "تدريب FRQ (مراحل)" },
  ],
  samples: [],
};

const sat: CurriculumDefinition = {
  id: "sat",
  family: "sat_act",
  labelEn: "SAT / ACT",
  labelAr: "SAT / ACT",
  shortEn: "SAT",
  shortAr: "SAT",
  descriptionEn: "Digital SAT Math and ACT Math practice with College Board–aligned skill tags.",
  descriptionAr: "رياضيات SAT الرقمي و ACT مع وسوم مهارات متوافقة مع College Board.",
  contentPhase: "default",
  defaultLanguage: "en",
  defaultTrackId: "sat-math",
  grades: [
    { id: "sat", labelEn: "SAT Math", labelAr: "رياضيات SAT" },
    { id: "act", labelEn: "ACT Math", labelAr: "رياضيات ACT" },
  ],
  tracks: [
    { id: "sat-math", labelEn: "SAT Math", labelAr: "SAT", examTrack: "sat", solverTrack: "sat" },
    { id: "act-math", labelEn: "ACT Math", labelAr: "ACT" },
  ],
  examArchives: [
    { id: "sat-bluebook", labelEn: "Bluebook / official practice", labelAr: "تدريب رسمي Bluebook" },
    { id: "sat-platform", labelEn: "Platform SAT papers", labelAr: "أوراق المنصة" },
  ],
  samples: [
    {
      id: "sat-linear",
      titleEn: "Heart of Algebra sample",
      titleAr: "عيّنة جبر أساسي",
      objectiveEn: "Solve a linear equation in one variable under SAT timing.",
      objectiveAr: "حل معادلة خطية بمتغير واحد بأسلوب SAT.",
      prerequisiteEn: "Distributive property and combining like terms.",
      prerequisiteAr: "خاصية التوزيع وجمع الحدود المتشابهة.",
      samplePromptEn: "If 3(x-2)+5=2x+9, what is the value of x?",
      samplePromptAr: "إذا كان 3(x-2)+5=2x+9، فما قيمة x؟",
      sampleLatex: "3(x-2)+5=2x+9",
    },
  ],
};

export const CURRICULUM_CATALOG: Record<CurriculumId, CurriculumDefinition> = {
  lebanese,
  "saudi-gcc": saudiGcc,
  ib,
  cambridge,
  ap,
  sat,
};

export const CURRICULUM_LIST: CurriculumDefinition[] = [
  lebanese,
  saudiGcc,
  ib,
  cambridge,
  ap,
  sat,
];

export function getCurriculum(id: string | null | undefined): CurriculumDefinition {
  if (id && id in CURRICULUM_CATALOG) {
    return CURRICULUM_CATALOG[id as CurriculumId];
  }
  return CURRICULUM_CATALOG[DEFAULT_CURRICULUM_ID];
}

export function isCurriculumId(value: string | null | undefined): value is CurriculumId {
  return Boolean(value && value in CURRICULUM_CATALOG);
}

/**
 * Map a curriculum to the exam hub `?track=` filter when one primary track exists.
 * Lebanese returns undefined so the hub shows all Brevet + Terminale papers.
 */
export function primaryExamTrackFor(id: CurriculumId): string | undefined {
  if (id === "lebanese") return undefined;
  const def = getCurriculum(id);
  const withExam = def.tracks.find((track) => track.examTrack);
  return withExam?.examTrack;
}

export function primarySolverTrackFor(id: CurriculumId): string | undefined {
  const def = getCurriculum(id);
  const withSolver = def.tracks.find((track) => track.solverTrack);
  return withSolver?.solverTrack ?? def.tracks[0]?.id;
}
