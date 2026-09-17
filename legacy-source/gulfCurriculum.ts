export type GulfMarket = "uae" | "saudi" | "qatar" | "kuwait" | "oman" | "bahrain";

export type EducationPathway = "national" | "international";

export type CurriculumSubject = {
  key: string;
  label: string;
  pilotStage: "launch" | "next";
};

export function getPathwayGuidance(pathway: EducationPathway, stage: string, grade: string, language: "en" | "ar") {
  if (language === "ar") return pathway === "international" ? `مسار دولي · ${stage === "sat" ? "تحضير SAT" : `المرحلة ${stage === "primary" ? "الابتدائية" : stage === "middle" ? "المتوسطة" : "الثانوية"}`} · الصف ${grade}` : `مسار وطني/مدرسي · ${stage === "sat" ? "تحضير SAT" : `المرحلة ${stage === "primary" ? "الابتدائية" : stage === "middle" ? "المتوسطة" : "الثانوية"}`} · الصف ${grade}`;
  return `${pathway === "international" ? "International pathway" : "National / local-school pathway"} · ${stage === "sat" ? "SAT preparation" : `${stage === "primary" ? "Primary" : stage === "middle" ? "Middle school" : "Secondary"}`} · Grade ${grade}`;
}

export function getPathwayReadiness(pathway: EducationPathway, language: "en" | "ar") {
  return language === "ar" ? pathway === "international" ? "إرشاد المسار الدولي: راجع لغة المدرسة ومعاييرها الدولية قبل نشر الحزمة." : "إرشاد المسار الوطني: طابق الحزمة مع الخطة الرسمية للوزارة والمدرسة قبل نشرها." : pathway === "international" ? "International readiness: confirm the school language and framework before publishing this content pack." : "National readiness: match this content pack to the ministry and school plan before publishing.";
}

export const gulfMarkets: Record<GulfMarket, { label: string; curriculumFamily: string; gradeBands: { middle: string[]; secondary: string[] }; secondaryTracks: string[]; officialSource: string; subjects: CurriculumSubject[] }> = {
  uae: {
    label: "United Arab Emirates",
    curriculumFamily: "UAE Ministry / school-specific tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["General", "Advanced", "International school framework"],
    officialSource: "https://u.ae/en/information-and-services/education/school-education-k-12/stages-and-streams-of-school-education",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Computer Science", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "business", label: "Business Studies", pilotStage: "next" },
    ],
  },
  saudi: {
    label: "Saudi Arabia",
    curriculumFamily: "Saudi general education / school-specific tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["General education", "Secondary pathways", "International school framework"],
    officialSource: "https://www.moe.gov.sa/en/education/generaleducation/StudyPlans/pages/default.aspx",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Digital Skills & Computer Science", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "life-skills", label: "Life Skills", pilotStage: "next" },
    ],
  },
  qatar: {
    label: "Qatar",
    curriculumFamily: "Qatar national framework / school-specific tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["Qatar national framework", "School-specific framework", "International school framework"],
    officialSource: "https://www.edu.gov.qa/en/Content/CurriculumSection",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Digital Learning", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "civic-studies", label: "Civic Studies", pilotStage: "next" },
    ],
  },
  kuwait: {
    label: "Kuwait",
    curriculumFamily: "Kuwait national / private-school tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["National", "Private-school framework", "International school framework"],
    officialSource: "https://www.moe.edu.kw/",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Computer Studies", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "life-skills", label: "Life Skills", pilotStage: "next" },
    ],
  },
  oman: {
    label: "Oman",
    curriculumFamily: "Oman national / private-school tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["National", "Private-school framework", "International school framework"],
    officialSource: "https://home.moe.gov.om/",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Information Technology", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "business", label: "Business Studies", pilotStage: "next" },
    ],
  },
  bahrain: {
    label: "Bahrain",
    curriculumFamily: "Bahrain national / private-school tracks",
    gradeBands: { middle: ["7", "8", "9"], secondary: ["10", "11", "12"] },
    secondaryTracks: ["National", "Private-school framework", "International school framework"],
    officialSource: "https://www.moe.gov.bh/",
    subjects: [
      { key: "mathematics", label: "Mathematics", pilotStage: "launch" },
      { key: "english", label: "English Language", pilotStage: "launch" },
      { key: "science", label: "Science", pilotStage: "launch" },
      { key: "computer-science", label: "Information & Communication Technology", pilotStage: "launch" },
      { key: "arabic", label: "Arabic Language", pilotStage: "next" },
      { key: "islamic-studies", label: "Islamic Studies", pilotStage: "next" },
      { key: "social-studies", label: "Social Studies", pilotStage: "next" },
      { key: "business", label: "Business Studies", pilotStage: "next" },
    ],
  },
};
