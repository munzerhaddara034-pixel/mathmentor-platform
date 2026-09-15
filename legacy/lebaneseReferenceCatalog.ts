export type LebaneseReference = {
  id: string;
  fileName: string;
  title: string;
  grade: string;
  branch: string;
  kind: "textbook" | "solution-guide" | "teacher-guide";
  pages: number;
  sourceStatus: "uploaded" | "duplicate-upload";
  topics: readonly string[];
};

export const lebaneseReferenceCatalog: readonly LebaneseReference[] = [
  {
    id: "lebanese-grade-9-mathematics",
    fileName: "grade9",
    title: "Mathematics — Intermediate Level, 9th year",
    grade: "Grade 9 / Brevet",
    branch: "General mathematics",
    kind: "textbook",
    pages: 264,
    sourceStatus: "uploaded",
    topics: ["Real numbers and algebra", "Polynomial expressions", "First-degree systems", "Thales and similar triangles", "Linear functions", "Statistics", "Right-triangle trigonometry", "Space geometry"],
  },
  {
    id: "lebanese-grade-9-solution-guide",
    fileName: "grade9solution",
    title: "Guide GR9",
    grade: "Grade 9 / Brevet",
    branch: "General mathematics",
    kind: "solution-guide",
    pages: 168,
    sourceStatus: "uploaded",
    topics: ["Relations and functions", "Linear functions", "Quadratic functions", "Trigonometry", "Statistics and probability"],
  },
  {
    id: "lebanese-grade-12-life-sciences",
    fileName: "grade12LS",
    title: "Mathematics — General and Life Sciences",
    grade: "Grade 12 / S3LS",
    branch: "Life Sciences",
    kind: "textbook",
    pages: 457,
    sourceStatus: "uploaded",
    topics: ["Limits and continuity", "Derivatives", "Inverse and trigonometric functions", "Vectors and space", "Complex numbers", "Integration", "Logarithms and exponentials", "Differential equations", "Statistics and counting", "Probabilities", "Linear systems"],
  },
  {
    id: "lebanese-grade-12-general-sciences",
    fileName: "12gs",
    title: "Mathematics — General Sciences (Specialization)",
    grade: "Grade 12 / S3GS",
    branch: "General Sciences",
    kind: "textbook",
    pages: 366,
    sourceStatus: "uploaded",
    topics: ["Propositional calculus", "Trigonometric equations", "Irrational functions", "Conics", "Numerical sequences", "Mean value theorems", "Complex numbers", "Integrals", "Transformations and planes", "Parametric curves", "Level curves", "Sphere"],
  },
  {
    id: "lebanese-grade-12-sociology-economics",
    fileName: "12se",
    title: "Mathematics — Sociology and Economics",
    grade: "Grade 12 / S3SE",
    branch: "Sociology and Economics",
    kind: "textbook",
    pages: 363,
    sourceStatus: "uploaded",
    topics: ["Economic functions", "Rational functions", "Composite and inverse functions", "Statistics", "Probability"],
  },
  {
    id: "lebanese-grade-12-se-solutions",
    fileName: "solution12se",
    title: "Mathematics Solution Manual — Sociology and Economics",
    grade: "Grade 12 / S3SE",
    branch: "Sociology and Economics",
    kind: "solution-guide",
    pages: 160,
    sourceStatus: "uploaded",
    topics: ["Economic functions", "Rational functions", "Composite and inverse functions", "Probability"],
  },
] as const;

export function getReferencesForBranch(branch: string) {
  return lebaneseReferenceCatalog.filter((reference) => reference.branch === branch);
}
