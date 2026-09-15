import { platformCourses } from "@/lib/courses";
import { trackProgressPercent } from "@/lib/gating";
import {
  asProgressEntries,
  findUserById,
  listEnrollments,
  listLessonProgress,
  listReminders,
} from "./db";
import type { SessionUser } from "./types";

export type DashboardCourse = {
  id: string;
  track: string;
  title: string;
  arabicTitle: string;
  href: string;
  practiceHref: string;
  percent: number;
  lessons: { id: string; arabicTitle: string; title: string; href: string; percent: number }[];
};

export type DashboardReminder = {
  id: string;
  title: string;
  arabicTitle: string;
  dueAt: string;
  href: string | null;
  daysLeft: number;
};

export type RoleDashboard = {
  user: SessionUser;
  linkedStudent?: SessionUser | null;
  courses: DashboardCourse[];
  reminders: DashboardReminder[];
};

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function buildRoleDashboard(user: SessionUser): RoleDashboard {
  const subject = user.role === "parent" && user.linkedStudentId ? findUserById(user.linkedStudentId) : user;
  const owner = subject ?? user;
  const progress = asProgressEntries(owner.id);
  const lessonRows = listLessonProgress(owner.id);
  const percentByLesson = new Map(lessonRows.map((row) => [row.lesson_id, row.percent]));
  const enrolled = listEnrollments(owner.id);
  const catalog = platformCourses();
  const courses = enrolled
    .map((enrollment) => {
      const course = catalog.find((item) => item.track === enrollment.track);
      if (!course) return null;
      const computed = trackProgressPercent(course.track, progress);
      const lessons = course.lessons.map((lesson) => ({
        ...lesson,
        percent: percentByLesson.get(lesson.id) ?? 0,
      }));
      const lessonAvg = lessons.length
        ? Math.round(lessons.reduce((sum, lesson) => sum + lesson.percent, 0) / lessons.length)
        : 0;
      const percent = Math.max(computed, enrollment.progress, lessonAvg);
      return {
        ...course,
        percent,
        lessons,
      };
    })
    .filter((item): item is DashboardCourse => Boolean(item));

  const reminders = listReminders(owner.id, owner.track).map((row) => ({
    id: row.id,
    title: row.title,
    arabicTitle: row.arabic_title,
    dueAt: row.due_at,
    href: row.href,
    daysLeft: daysLeft(row.due_at),
  }));

  return {
    user,
    linkedStudent: user.role === "parent" ? subject ?? null : null,
    courses,
    reminders,
  };
}
