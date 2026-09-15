import { academyLessons, classroomScenes, type AcademyLesson } from "./academyLessons";
import {
  BREVET_GEOMETRY_LESSON_ID,
  BREVET_GEOMETRY_VIDEO_EN,
  BREVET_GEOMETRY_VIDEO_FR,
  brevetGeometryFallbackEn,
  brevetGeometryFallbackFr,
  brevetGeometryNotesEn,
  brevetGeometryNotesFr,
} from "./brevetGeometryThales";
import {
  GRADE_12_LS_CONTINUITY_LESSON_ID,
  GRADE_12_LS_CONTINUITY_VIDEO_EN,
  GRADE_12_LS_CONTINUITY_VIDEO_FR,
  grade12LsContinuityFallbackEn,
  grade12LsContinuityFallbackFr,
  grade12LsContinuityNotesEn,
  grade12LsContinuityNotesFr,
} from "./grade12LsContinuity";
import {
  GRADE_12_LS_DERIVATIVES_LESSON_ID,
  GRADE_12_LS_DERIVATIVES_VIDEO_EN,
  GRADE_12_LS_DERIVATIVES_VIDEO_FR,
  grade12LsDerivativesFallbackEn,
  grade12LsDerivativesFallbackFr,
  grade12LsDerivativesNotesEn,
  grade12LsDerivativesNotesFr,
} from "./grade12LsDerivatives";
import { GRADE_12_LS_LIMITS_LESSON_ID, grade12LsLimitsNotes } from "./grade12LsLimits";
import type { LessonLang, NoteBlock } from "./lessonNotes";
import type { StoryboardScene } from "./types";

export type VideoLessonPack = {
  lessonId: string;
  slug: string;
  watchPath: string;
  titleEn: string;
  titleFr: string;
  trackLabelEn: string;
  trackLabelFr: string;
  videoEn: string;
  videoFr: string;
  notesEn: NoteBlock[];
  notesFr: NoteBlock[];
  fallbackEn: StoryboardScene[];
  fallbackFr: StoryboardScene[];
  practiceHref: string;
  contestHref: string;
  contestLabelEn: string;
  contestLabelFr: string;
  bilingual: boolean;
};

export const videoLessonPacks: VideoLessonPack[] = [
  {
    lessonId: GRADE_12_LS_CONTINUITY_LESSON_ID,
    slug: "grade-12-ls-continuity",
    watchPath: "/lessons/grade-12-ls-continuity",
    titleEn: "Continuity at a point",
    titleFr: "Continuité en un point",
    trackLabelEn: "Grade 12 LS",
    trackLabelFr: "Terminale SV",
    videoEn: GRADE_12_LS_CONTINUITY_VIDEO_EN,
    videoFr: GRADE_12_LS_CONTINUITY_VIDEO_FR,
    notesEn: grade12LsContinuityNotesEn,
    notesFr: grade12LsContinuityNotesFr,
    fallbackEn: grade12LsContinuityFallbackEn,
    fallbackFr: grade12LsContinuityFallbackFr,
    practiceHref: `/practice/take?lessonId=${GRADE_12_LS_CONTINUITY_LESSON_ID}&mode=free`,
    contestHref: "/practice/take?bank=g12-ls-functions&mode=contest",
    contestLabelEn: "Functions contest",
    contestLabelFr: "Concours d'étude de fonctions",
    bilingual: true,
  },
  {
    lessonId: GRADE_12_LS_DERIVATIVES_LESSON_ID,
    slug: "grade-12-ls-derivatives",
    watchPath: "/lessons/grade-12-ls-derivatives",
    titleEn: "Derivative at a point",
    titleFr: "Nombre dérivé",
    trackLabelEn: "Grade 12 LS",
    trackLabelFr: "Terminale SV",
    videoEn: GRADE_12_LS_DERIVATIVES_VIDEO_EN,
    videoFr: GRADE_12_LS_DERIVATIVES_VIDEO_FR,
    notesEn: grade12LsDerivativesNotesEn,
    notesFr: grade12LsDerivativesNotesFr,
    fallbackEn: grade12LsDerivativesFallbackEn,
    fallbackFr: grade12LsDerivativesFallbackFr,
    practiceHref: `/practice/take?lessonId=${GRADE_12_LS_DERIVATIVES_LESSON_ID}&mode=free`,
    contestHref: "/practice/take?bank=g12-ls-functions&mode=contest",
    contestLabelEn: "Functions contest",
    contestLabelFr: "Concours d'étude de fonctions",
    bilingual: true,
  },
  {
    lessonId: BREVET_GEOMETRY_LESSON_ID,
    slug: "brevet-geometry",
    watchPath: "/lessons/brevet-geometry",
    titleEn: "Thales in a triangle",
    titleFr: "Thalès dans un triangle",
    trackLabelEn: "Brevet geometry",
    trackLabelFr: "Géométrie Brevet",
    videoEn: BREVET_GEOMETRY_VIDEO_EN,
    videoFr: BREVET_GEOMETRY_VIDEO_FR,
    notesEn: brevetGeometryNotesEn,
    notesFr: brevetGeometryNotesFr,
    fallbackEn: brevetGeometryFallbackEn,
    fallbackFr: brevetGeometryFallbackFr,
    practiceHref: `/practice/take?lessonId=${BREVET_GEOMETRY_LESSON_ID}&mode=free`,
    contestHref: "/practice/take?bank=brevet-geometry&mode=contest",
    contestLabelEn: "Brevet geometry contest",
    contestLabelFr: "Concours de géométrie Brevet",
    bilingual: true,
  },
];

const packsByLessonId = new Map(videoLessonPacks.map((pack) => [pack.lessonId, pack]));
const packsBySlug = new Map(videoLessonPacks.map((pack) => [pack.slug, pack]));

export function getVideoLessonPack(idOrSlug: string): VideoLessonPack | undefined {
  return packsByLessonId.get(idOrSlug) ?? packsBySlug.get(idOrSlug);
}

export function notesForPack(pack: VideoLessonPack, lang: LessonLang): NoteBlock[] {
  return lang === "fr" ? pack.notesFr : pack.notesEn;
}

export function scenesForPack(pack: VideoLessonPack, lang: LessonLang, lesson?: AcademyLesson): StoryboardScene[] {
  if (lang === "fr") return pack.fallbackFr;
  if (pack.fallbackEn.length) return pack.fallbackEn;
  return lesson ? classroomScenes(lesson) : [];
}

export function copyForLang(pack: VideoLessonPack, lang: LessonLang) {
  const fr = lang === "fr";
  return {
    title: fr ? pack.titleFr : pack.titleEn,
    trackLabel: fr ? pack.trackLabelFr : pack.trackLabelEn,
    contestLabel: fr ? pack.contestLabelFr : pack.contestLabelEn,
    afterVideo: fr
      ? "Après la vidéo : relire le tableau, puis l'entraînement ou le concours."
      : "After the video: reread the board, then practice or the contest.",
    classroom: fr ? "Page de classe" : "Classroom page",
    exam: fr ? "Examen de la leçon" : "Lesson exam",
    practice: fr ? "Entraînement" : "Practice",
    finished: fr ? "Leçon terminée" : "I finished this lesson",
    saved: fr ? "Enregistré" : "Saved to your path",
  };
}

export function academyLessonForPack(pack: VideoLessonPack): AcademyLesson | undefined {
  return academyLessons.find((lesson) => lesson.id === pack.lessonId);
}

export const LIMITS_WATCH_PATH = "/lessons/grade-12-ls-ch1";

export function featuredWatchCards() {
  return [
    {
      href: LIMITS_WATCH_PATH,
      titleEn: "Limits intro",
      titleFr: "Limites — intro",
      lessonId: GRADE_12_LS_LIMITS_LESSON_ID,
      bilingual: false,
      notes: grade12LsLimitsNotes.length > 0,
    },
    ...videoLessonPacks.map((pack) => ({
      href: pack.watchPath,
      titleEn: pack.titleEn,
      titleFr: pack.titleFr,
      lessonId: pack.lessonId,
      bilingual: pack.bilingual,
      notes: true,
    })),
  ];
}
