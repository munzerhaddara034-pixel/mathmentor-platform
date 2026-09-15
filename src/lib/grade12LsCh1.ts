import type { ContentDraft } from "./types";
import {
  GRADE_12_LS_LIMITS_LESSON_ID,
  GRADE_12_LS_LIMITS_VIDEO_URL,
  grade12LsLimitsFallbackScenes,
  grade12LsLimitsPrintableNotes,
} from "./grade12LsLimits";

export const GRADE_12_LS_CH1_ID = "lesson-grade-12-ls-ch1";
export const grade12LsCh1Scenes = grade12LsLimitsFallbackScenes;

export function grade12LsCh1Draft(): ContentDraft {
  return {
    id: GRADE_12_LS_CH1_ID,
    libraryItemId: "grade-12-ls-book",
    kind: "lesson-video",
    title: "صف 12 علوم الحياة · النهايات",
    skill: "النهايات: اقتراب، 0/0، حد مسيطر",
    questionRef: GRADE_12_LS_LIMITS_LESSON_ID,
    language: "ar",
    videoScript: grade12LsCh1Scenes
      .map((scene, index) => `المشهد ${index + 1} · ${scene.title}\n${scene.narration}\nاللوح:\n${scene.board}`)
      .join("\n\n"),
    storyboard: grade12LsCh1Scenes,
    printableSolution: grade12LsLimitsPrintableNotes,
    videoUrl: GRADE_12_LS_LIMITS_VIDEO_URL,
    status: "approved",
    professorNote: "وحدة تجريبية: فيديو شرح حقيقي + ملخص عربي + بنك أسئلة بمستوى الشهادة اللبنانية. ليست قوالب تعريف.",
    reviewedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}
