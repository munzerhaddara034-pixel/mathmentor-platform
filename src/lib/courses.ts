import { academyLessons, gradeGroups } from "@/lib/academyLessons";
import { trackProgressPercent } from "@/lib/gating";
import type { ProgressEntry } from "@/lib/types";

export type PlatformCourse = {
  id: string;
  track: string;
  title: string;
  arabicTitle: string;
  href: string;
  practiceHref: string;
  lessons: { id: string; arabicTitle: string; title: string; href: string }[];
};

const FEATURED_LESSON_HREF: Record<string, string> = {
  "grade-12-ch1": "/classroom/grade-12-ch1",
  "grade-12-ch2": "/lessons/grade-12-ls-continuity",
  "grade-12-ch3": "/lessons/grade-12-ls-derivatives",
  "grade-9-ch4": "/lessons/brevet-geometry",
};

const ARABIC_TRACK: Record<string, string> = {
  "grade-7": "الصف السابع",
  "grade-8": "الصف الثامن",
  "grade-9": "الشهادة المتوسطة · Brevet",
  "grade-11": "الثانوية · الصف 11",
  "grade-12": "الثانوية · علوم الحياة",
  sat: "رياضيات SAT",
};

const PRACTICE_HREF: Record<string, string> = {
  "grade-9": "/practice/take?bank=brevet-geometry&mode=contest",
  "grade-12": "/practice/take?bank=g12-ls-functions&mode=contest",
  sat: "/practice",
  "grade-11": "/practice",
  "grade-7": "/practice",
  "grade-8": "/practice",
};

export function platformCourses(): PlatformCourse[] {
  return gradeGroups.map((group) => ({
    id: group.track,
    track: group.track,
    title: group.title,
    arabicTitle: ARABIC_TRACK[group.track] ?? group.title,
    href: "/classroom",
    practiceHref: PRACTICE_HREF[group.track] ?? "/practice",
    lessons: academyLessons
      .filter((lesson) => lesson.track === group.track)
      .slice(0, 4)
      .map((lesson) => ({
        id: lesson.id,
        arabicTitle: lesson.arabicTitle,
        title: lesson.title,
        href: FEATURED_LESSON_HREF[lesson.id] ?? `/classroom/${lesson.id}`,
      })),
  }));
}

export function courseByTrack(track: string) {
  return platformCourses().find((course) => course.track === track);
}

export function progressForTrack(track: string, progress: ProgressEntry[]) {
  return trackProgressPercent(track, progress);
}
