export { bilingualSchema, lessonTimelineSchema, parseLessonTimeline, TIMELINE_STORAGE_KEY } from "./timeline";
export type { LessonTimeline, LessonLanguage, CertificateTrack } from "./timeline";
export {
  createAvatarTalkingVideo,
  fetchAvatarTalkingVideo,
  hasHeyGenKey,
  buildHeyGenGeneratePayload,
} from "./heygen";
export { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";
export { disabledGeoGebra, getGeoGebraHook } from "./geogebra";
export { generateLessonScript, buildTemplateScript } from "./scriptGenerator";
export { exponentialFunctionsLesson, complexNumbersLesson, getSampleLesson } from "./sampleLessons";
export { officialExamSceneDocument, officialExamFourPhaseLesson } from "./seedLesson";
export { ensurePedagogy } from "./pedagogy";
export { auditPedagogy } from "./timeline";
export { hasDesmosKey, desmosScriptSrc } from "./desmos";
