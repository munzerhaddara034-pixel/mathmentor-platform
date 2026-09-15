import type { EducationPathway, GulfMarket } from "./gulfCurriculum";

export type LessonPackage = {
  id: string;
  title: string;
  description: string;
  source: string;
  status: "pilot" | "planned";
  priority: "Start here" | "Build next" | "Explore next";
  lessonTitle: string;
  lessonTitles: string[];
  canStart: boolean;
};

const arabicSubjects: Record<string, string> = {
  mathematics: "الرياضيات",
  english: "اللغة الإنجليزية",
  science: "العلوم",
  "computer-science": "علوم الحاسوب",
  arabic: "اللغة العربية",
  "social-studies": "الدراسات الاجتماعية",
  "islamic-studies": "التربية الإسلامية",
  business: "إدارة الأعمال",
  "life-skills": "المهارات الحياتية",
  "civic-studies": "الدراسات المدنية",
};

export function getRecommendedLessonPackages(
  market: GulfMarket,
  marketLabel: string,
  pathway: EducationPathway,
  stage: string,
  grade: string,
  subjectKey: string,
  language: "en" | "ar",
): LessonPackage[] {
  const subject = language === "ar" ? arabicSubjects[subjectKey] || subjectKey : subjectKey.replaceAll("-", " ");
  const marketName = marketLabel;
  const pathwayName = pathway === "international" ? (language === "ar" ? "المسار الدولي" : "international pathway") : (language === "ar" ? "المسار الوطني/المدرسي" : "national / local-school pathway");
  const level = stage === "sat" ? (language === "ar" ? "تحضير SAT" : "SAT preparation") : language === "ar" ? `المرحلة ${stage === "primary" ? "الابتدائية" : stage === "middle" ? "المتوسطة" : "الثانوية"} · الصف ${grade}` : `${stage === "primary" ? "Primary" : stage === "middle" ? "Middle school" : "Secondary"} · Grade ${grade}`;
  const source = `${marketName} · ${pathwayName}`;
  const lessonTitles = subjectKey === "mathematics" ? stage === "sat" ? ["Algebra", "Advanced Math", "Data & problem-solving"] : stage === "secondary" ? ["Grade 12 Certificate: Functions", "Certificate Revision Studio", "Grade 9 Certificate: Algebra"] : ["Grade 9 Certificate: Algebra", "Certificate Revision Studio", "Grade 12 Certificate: Functions"] : ["Certificate Revision Studio", "Grade 9 Certificate: Algebra", "Grade 12 Certificate: Functions"];
  const lessonTitle = lessonTitles[0];
  return language === "ar" ? [
    { id: `${market}-foundations-${subjectKey}-${stage}-${grade}`, title: `أساسيات ${subject}`, description: `مفاهيم أساسية قصيرة في ${subject} مبنية لـ${level}.`, source, status: "pilot", priority: "Start here", lessonTitle, lessonTitles, canStart: true },
    { id: `${market}-practice-${subjectKey}-${stage}-${grade}`, title: `تدريب ${subject} المتدرج`, description: `أمثلة ومسائل قصيرة مع تغذية راجعة فورية لمسارك.`, source, status: "pilot", priority: "Build next", lessonTitle, lessonTitles, canStart: true },
    { id: `${market}-challenge-${subjectKey}-${stage}-${grade}`, title: `تحدي ${subject}`, description: `مسابقة زمنية خفيفة لقياس الفهم قبل الانتقال إلى الوحدة التالية.`, source, status: "planned", priority: "Explore next", lessonTitle, lessonTitles, canStart: false },
  ] : [
    { id: `${market}-foundations-${subjectKey}-${stage}-${grade}`, title: `${subject} foundations`, description: `Short core concepts for ${level}.`, source, status: "pilot", priority: "Start here", lessonTitle, lessonTitles, canStart: true },
    { id: `${market}-practice-${subjectKey}-${stage}-${grade}`, title: `${subject} guided practice`, description: "Worked examples and short practice with immediate feedback.", source, status: "pilot", priority: "Build next", lessonTitle, lessonTitles, canStart: true },
    { id: `${market}-challenge-${subjectKey}-${stage}-${grade}`, title: `${subject} challenge`, description: "A light timed challenge to check understanding before the next unit.", source, status: "planned", priority: "Explore next", lessonTitle, lessonTitles, canStart: false },
  ];
}
