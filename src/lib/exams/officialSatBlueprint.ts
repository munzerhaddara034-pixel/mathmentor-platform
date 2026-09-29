/**
 * Official Digital SAT Math blueprint (public College Board structure) + links.
 * Pedagogy only — never scrape or store College Board exam item text.
 */

export const OFFICIAL_SAT_PRACTICE_HUB =
  "https://satsuite.collegeboard.org/practice/practice-tests/paper";

export type OfficialSatTestNumber = 5 | 10 | 11;

export type OfficialSatDomainId =
  | "algebra"
  | "advanced-math"
  | "problem-solving-data"
  | "geometry-trigonometry";

export type OfficialSatDomain = {
  id: OfficialSatDomainId;
  en: string;
  ar: string;
  /** Publicly documented approximate share of Math section. */
  approxShare: string;
  skillTags: string[];
};

/** Public Digital SAT Math structure (College Board documentation). */
export const DIGITAL_SAT_MATH_BLUEPRINT = {
  section: "Math",
  modules: 2,
  questionsPerModule: 27,
  questionsTotal: 54,
  /** Approx. minutes per module (public timing guidance). */
  minutesPerModule: 35,
  responseTypes: ["mcq", "spr"] as const,
  mcqChoices: ["A", "B", "C", "D"] as const,
  calculator: "allowed throughout Math",
  domains: [
    {
      id: "algebra",
      en: "Algebra",
      ar: "جبر",
      approxShare: "~35%",
      skillTags: [
        "linear-equation",
        "linear-system",
        "linear-inequality",
        "absolute-value",
        "function-eval",
      ],
    },
    {
      id: "advanced-math",
      en: "Advanced Math",
      ar: "رياضيات متقدمة",
      approxShare: "~35%",
      skillTags: ["quadratic-factor", "exponential-model", "rational-simplify", "function-eval"],
    },
    {
      id: "problem-solving-data",
      en: "Problem-Solving and Data Analysis",
      ar: "حل مسائل وبيانات",
      approxShare: "~15%",
      skillTags: ["percent", "unit-rate", "mean", "slope-meaning"],
    },
    {
      id: "geometry-trigonometry",
      en: "Geometry and Trigonometry",
      ar: "هندسة ومثلثات",
      approxShare: "~15%",
      skillTags: ["pythagoras", "circle-area", "similar-triangles", "trig-ratio"],
    },
  ] as OfficialSatDomain[],
} as const;

export type OfficialSatLink = {
  test: OfficialSatTestNumber;
  labelEn: string;
  labelAr: string;
  pdfUrl: string;
  /** Pedagogy note only — which domain mix to emphasize when generating originals. */
  pedagogyFocus: OfficialSatDomainId[];
};

export const OFFICIAL_SAT_LINKS: OfficialSatLink[] = [
  {
    test: 5,
    labelEn: "Practice Test #5 — Math PDF",
    labelAr: "النموذج الرسمي رقم ٥ — رياضيات PDF",
    pdfUrl: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-5-digital.pdf",
    pedagogyFocus: ["algebra", "advanced-math", "problem-solving-data", "geometry-trigonometry"],
  },
  {
    test: 10,
    labelEn: "Practice Test #10 — Math PDF",
    labelAr: "النموذج الرسمي رقم ١٠ — رياضيات PDF",
    pdfUrl: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-10-digital.pdf",
    pedagogyFocus: ["algebra", "advanced-math", "problem-solving-data", "geometry-trigonometry"],
  },
  {
    test: 11,
    labelEn: "Practice Test #11 — Math PDF",
    labelAr: "النموذج الرسمي رقم ١١ — رياضيات PDF",
    pdfUrl: "https://satsuite.collegeboard.org/media/pdf/sat-practice-test-11-digital.pdf",
    pedagogyFocus: ["algebra", "advanced-math", "problem-solving-data", "geometry-trigonometry"],
  },
];

export function officialSatLink(test: OfficialSatTestNumber): OfficialSatLink | undefined {
  return OFFICIAL_SAT_LINKS.find((row) => row.test === test);
}

export function officialStyleTag(test: OfficialSatTestNumber): string {
  return `official-sat-style-${test}`;
}

export function blueprintSkillsFor(
  test: OfficialSatTestNumber,
  module?: 1 | 2,
  domain?: OfficialSatDomainId,
): string[] {
  const link = officialSatLink(test);
  const domains = DIGITAL_SAT_MATH_BLUEPRINT.domains.filter((d) => {
    if (domain) return d.id === domain;
    if (!link) return true;
    return link.pedagogyFocus.includes(d.id);
  });
  // Module 1 vs 2: same domains publicly; slight pedagogy bias for variety.
  const skills = domains.flatMap((d) => d.skillTags);
  if (module === 2) {
    return [...skills].reverse();
  }
  return skills;
}

/** Ready bilingual prompt for the AI employee (staff copies / sends). */
export function buildAiEmployeeOfficialPrompt(opts: {
  officialTest: OfficialSatTestNumber;
  count: number;
  skill?: string;
  module?: 1 | 2;
  skillNote?: string;
}): { ar: string; en: string; combined: string } {
  const skillPart = opts.skill?.trim() || "متنوعة حسب مجالات Digital SAT";
  const skillEn = opts.skill?.trim() || "mixed Digital SAT Math domains";
  const modulePart = opts.module ? `، الوحدة (Module) ${opts.module}` : "";
  const moduleEn = opts.module ? `, Module ${opts.module}` : "";
  const noteAr = opts.skillNote?.trim()
    ? ` ملاحظة المعلّم: ${opts.skillNote.trim()}`
    : "";
  const noteEn = opts.skillNote?.trim()
    ? ` Teacher note: ${opts.skillNote.trim()}`
    : "";

  const ar = `أنت موظف الذكاء الاصطناعي لـ MathMentor. ارجع إلى بنية اختبار Digital SAT Math الرسمي (Module، 27 سؤالاً، جبر / رياضيات متقدمة / حل مسائل وبيانات / هندسة ومثلثات، MCQ + SPR). أنشئ ${opts.count} أسئلة أصلية على نسق النموذج الرسمي رقم ${opts.officialTest}${modulePart}، مهارة: ${skillPart}، بتنسيق KaTeX اللبناني/Word، مع خيارات وإجابة وحل مختصر. لا تنسخ نص College Board — أسئلة أصلية فقط.${noteAr}`;

  const en = `You are the MathMentor AI employee. Follow the official Digital SAT Math blueprint (2 modules × ~27 questions; Algebra / Advanced Math / Problem-Solving & Data / Geometry & Trig; MCQ A–D + SPR). Create ${opts.count} ORIGINAL items in the style of College Board Practice Test #${opts.officialTest}${moduleEn}, skill: ${skillEn}, Lebanese KaTeX/Word format, with choices, answer, and short solution. Do NOT copy College Board wording — original only.${noteEn}`;

  return { ar, en, combined: `${ar}\n\n${en}` };
}
