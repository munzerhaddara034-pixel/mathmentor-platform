import { describe, expect, it } from "vitest";
import { calculateGrade12DiagnosticReport, calculateGrade12LongMockExamReport, grade12LongMockExam, grade12SpecializationExams } from "./mockExam";

describe("Grade 12 diagnostic mock exam", () => {
  it("is longer than the mini assessment and has a timed structure", () => {
    expect(grade12LongMockExam.questions).toHaveLength(10);
    expect(grade12LongMockExam.durationSeconds).toBe(30 * 60);
    expect(new Set(grade12LongMockExam.questions.map((question) => question.skill)).size).toBeGreaterThanOrEqual(6);
  });

  it("reports per-skill results and identifies review priorities", () => {
    const answers = Object.fromEntries(grade12LongMockExam.questions.map((question, index) => [question.id, index === 0 ? question.correctIndex : 0]));
    const report = calculateGrade12LongMockExamReport(answers);
    expect(report.total).toBe(10);
    expect(report.answered).toBe(10);
    expect(report.skills.length).toBeGreaterThanOrEqual(6);
    expect(report.skills.every((skill) => ["strength", "developing", "priority"].includes(skill.status))).toBe(true);
    expect(report.weakestSkill).toBeTruthy();
    expect(report.strongestSkill).toBeTruthy();
  });

  it("provides separate Life Sciences and General Sciences selections", () => {
    const lifeSciences = grade12SpecializationExams["Life Sciences"];
    const generalSciences = grade12SpecializationExams["General Sciences"];
    const sociologyEconomics = grade12SpecializationExams["Sociology and Economics"];
    expect(lifeSciences.questions.length).toBeGreaterThan(0);
    expect(generalSciences.questions.length).toBeGreaterThan(0);
    expect(sociologyEconomics.questions).toHaveLength(20);
    expect(lifeSciences.questions.every((question) => question.branch === "Life Sciences")).toBe(true);
    expect(generalSciences.questions.every((question) => question.branch === "General Sciences")).toBe(true);
    expect(sociologyEconomics.questions.every((question) => question.branch === "Sociology and Economics")).toBe(true);
    expect(sociologyEconomics.questions.every((question) => question.correctIndex >= 0 && question.correctIndex < question.options.length)).toBe(true);
    expect(calculateGrade12DiagnosticReport(generalSciences, {}).total).toBe(generalSciences.questions.length);
    expect(calculateGrade12DiagnosticReport(sociologyEconomics, {}).total).toBe(sociologyEconomics.questions.length);
    expect(sociologyEconomics.sections).toHaveLength(4);
    expect(sociologyEconomics.sections.reduce((sum, section) => sum + section.durationSeconds, 0)).toBe(30 * 60);
    expect(sociologyEconomics.sections.flatMap((section) => section.questionIds)).toHaveLength(20);
    expect(new Set(sociologyEconomics.sections.flatMap((section) => section.questionIds)).size).toBe(20);
    expect(lifeSciences.sections).toHaveLength(4);
    expect(lifeSciences.sections.reduce((sum, section) => sum + section.durationSeconds, 0)).toBe(30 * 60);
    expect(generalSciences.sections).toHaveLength(3);
    expect(generalSciences.sections.reduce((sum, section) => sum + section.durationSeconds, 0)).toBe(30 * 60);
    expect(lifeSciences.sections.flatMap((section) => section.questionIds)).toHaveLength(lifeSciences.questions.length);
    expect(generalSciences.sections.flatMap((section) => section.questionIds)).toHaveLength(generalSciences.questions.length);
  });

  it("handles an unanswered attempt without inventing performance", () => {
    const report = calculateGrade12LongMockExamReport({});
    expect(report.correct).toBe(0);
    expect(report.answered).toBe(0);
    expect(report.percentage).toBe(0);
    expect(report.skills.every((skill) => skill.correct === 0 && skill.percentage === 0 && skill.status === "priority")).toBe(true);
  });
});
