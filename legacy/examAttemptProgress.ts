import type { Grade12ExamSection, SkillDiagnostic } from "./mockExam";

export function serializeExamSections(sections: readonly Grade12ExamSection[]) {
  return JSON.stringify(sections.map((section) => ({
    id: section.id,
    title: section.title,
    arabicTitle: section.arabicTitle,
    questionCount: section.questionIds.length,
    durationSeconds: section.durationSeconds,
  })));
}

export type ReviewSnapshotItem = { id: string; skill: string; prompt: string; arabicPrompt: string; selectedIndex: number | null; selectedAnswer: string | null; correctIndex: number; correctAnswer: string; explanation: string; arabicExplanation: string; isCorrect: boolean };

export function parseReviewSnapshot(snapshot: string): ReviewSnapshotItem[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReviewSnapshotItem => Boolean(item) && typeof item === "object" && typeof (item as ReviewSnapshotItem).id === "string" && typeof (item as ReviewSnapshotItem).skill === "string" && typeof (item as ReviewSnapshotItem).prompt === "string" && typeof (item as ReviewSnapshotItem).arabicPrompt === "string" && (typeof (item as ReviewSnapshotItem).selectedIndex === "number" || (item as ReviewSnapshotItem).selectedIndex === null) && typeof (item as ReviewSnapshotItem).correctAnswer === "string" && typeof (item as ReviewSnapshotItem).explanation === "string" && typeof (item as ReviewSnapshotItem).arabicExplanation === "string" && typeof (item as ReviewSnapshotItem).isCorrect === "boolean");
  } catch {
    return [];
  }
}

export function parseSkillSnapshot(snapshot: string): SkillDiagnostic[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SkillDiagnostic => Boolean(item) && typeof item === "object" && typeof (item as SkillDiagnostic).skill === "string" && typeof (item as SkillDiagnostic).percentage === "number" && typeof (item as SkillDiagnostic).correct === "number" && typeof (item as SkillDiagnostic).total === "number" && typeof (item as SkillDiagnostic).status === "string");
  } catch {
    return [];
  }
}

export function parseSolutionSteps(snapshot: string): string[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (!Array.isArray(parsed)) return snapshot.trim() ? [snapshot] : [];
    return parsed.filter((step): step is string => typeof step === "string");
  } catch {
    return snapshot.trim() ? [snapshot] : [];
  }
}
