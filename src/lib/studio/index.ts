export { bilingualSchema, lessonTimelineSchema, parseLessonTimeline, TIMELINE_STORAGE_KEY } from "./timeline";
export type { LessonTimeline, LessonLanguage, CertificateTrack } from "./timeline";
export { createAvatarTalkingVideo, fetchAvatarTalkingVideo, hasHeyGenKey } from "./heygen";
export { disabledGeoGebra, getGeoGebraHook } from "./geogebra";
export { generateLessonScript, buildTemplateScript } from "./scriptGenerator";
export { exponentialFunctionsLesson, complexNumbersLesson, getSampleLesson } from "./sampleLessons";
export { ensurePedagogy } from "./pedagogy";
