import { academyLessons } from "./academyLessons";
import type { ProgressEntry } from "./types";

export const PASS_SCORE = 70;

export function isLessonUnlocked(lessonId: string, progress: ProgressEntry[]) {
  const lesson = academyLessons.find((item) => item.id === lessonId);
  if (!lesson) return true;
  if (lesson.chapter <= 1) return true;
  const previous = academyLessons.find((item) => item.track === lesson.track && item.chapter === lesson.chapter - 1);
  if (!previous) return true;
  return progress.some((item) => item.lessonId === previous.id && item.passedQuiz);
}

export function trackProgressPercent(track: string, progress: ProgressEntry[]) {
  const lessons = academyLessons.filter((item) => item.track === track);
  if (!lessons.length) return 0;
  const done = lessons.filter((lesson) => progress.some((item) => item.lessonId === lesson.id && item.passedQuiz)).length;
  return Math.round((done / lessons.length) * 100);
}

export function badgesFor(studentName: string, attempts: { studentName: string; score: number; passed: boolean; lessonId: string }[]) {
  const mine = attempts.filter((item) => item.studentName === studentName);
  const badges: { id: string; title: string }[] = [];
  if (mine.some((item) => item.passed)) badges.push({ id: "first", title: "أول نجاح" });
  if (mine.some((item) => item.score === 100)) badges.push({ id: "perfect", title: "درجة كاملة" });
  if (mine.filter((item) => item.passed).length >= 3) badges.push({ id: "streak", title: "ثلاث وحدات" });
  return badges;
}
