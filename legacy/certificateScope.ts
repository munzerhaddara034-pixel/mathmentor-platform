export type CertificateScopeId =
  | "lebanon-brevet"
  | "lebanon-secondary-sciences"
  | "lebanon-secondary-humanities"
  | "gulf-middle"
  | "gulf-secondary";

export type CertificateScope = {
  id: CertificateScopeId;
  market: "lebanon" | "gulf";
  stage: "middle" | "secondary";
  label: string;
  arabicLabel: string;
  grades: string[];
  priority: "launch" | "next";
  focusSubjects: string[];
  reviewNote: string;
};

export const certificateScopes: CertificateScope[] = [
  {
    id: "lebanon-brevet",
    market: "lebanon",
    stage: "middle",
    label: "Lebanese Brevet · Grade 9",
    arabicLabel: "الشهادة المتوسطة اللبنانية · الصف التاسع",
    grades: ["9"],
    priority: "launch",
    focusSubjects: ["Mathematics", "Arabic", "English", "French", "Science", "Social Studies"],
    reviewNote: "Map every lesson to the current MEHE/CRDP plan and professor approval before publication.",
  },
  {
    id: "lebanon-secondary-sciences",
    market: "lebanon",
    stage: "secondary",
    label: "Lebanese Secondary Certificate · Sciences",
    arabicLabel: "الشهادة الثانوية اللبنانية · فرع العلوم",
    grades: ["10", "11", "12"],
    priority: "launch",
    focusSubjects: ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Arabic"],
    reviewNote: "Confirm branch-specific official subjects and exam weighting against the current source documents.",
  },
  {
    id: "lebanon-secondary-humanities",
    market: "lebanon",
    stage: "secondary",
    label: "Lebanese Secondary Certificate · Humanities & Economics",
    arabicLabel: "الشهادة الثانوية اللبنانية · الآداب والإنسانيات والاقتصاد",
    grades: ["10", "11", "12"],
    priority: "launch",
    focusSubjects: ["Mathematics", "Economics", "Sociology", "History", "Geography", "Languages"],
    reviewNote: "Branch naming and assessment details require confirmation from the current MEHE/CRDP references.",
  },
  {
    id: "gulf-middle",
    market: "gulf",
    stage: "middle",
    label: "Gulf Middle School · Grades 7–9",
    arabicLabel: "المرحلة المتوسطة الخليجية · الصفوف 7–9",
    grades: ["7", "8", "9"],
    priority: "next",
    focusSubjects: ["Mathematics", "English", "Science", "Arabic", "Digital Skills"],
    reviewNote: "Select a country and school framework before claiming alignment; Gulf systems are not one single curriculum.",
  },
  {
    id: "gulf-secondary",
    market: "gulf",
    stage: "secondary",
    label: "Gulf Secondary School · Grades 10–12",
    arabicLabel: "المرحلة الثانوية الخليجية · الصفوف 10–12",
    grades: ["10", "11", "12"],
    priority: "next",
    focusSubjects: ["Mathematics", "English", "Science", "Computer Science", "Arabic"],
    reviewNote: "Model national, private, and international tracks separately and review each country pack before publication.",
  },
];

function localizeScopes(scopes: CertificateScope[], language: "en" | "ar") {
  return scopes.map((scope) => ({ ...scope, displayLabel: language === "ar" ? scope.arabicLabel : scope.label }));
}

export function getPriorityCertificateScopes(language: "en" | "ar") {
  return localizeScopes(certificateScopes.filter((scope) => scope.priority === "launch"), language);
}

export function getGulfCertificateScopes(language: "en" | "ar") {
  return localizeScopes(certificateScopes.filter((scope) => scope.market === "gulf"), language);
}
