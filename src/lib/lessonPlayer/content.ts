/**
 * Server-side manifest loader: `content/lessons/<id>/lesson.json`. Relative media paths resolve against
 * `/lesson-media/<id>/` (files under `public/lesson-media/<id>/`, or absolute CDN URLs in the manifest).
 * Lessons that only have the older `video.json` storyboard are simply "not found" here.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LESSON_ID_RE, parseLessonManifest, type ManifestResult } from "./manifest";

export const LESSON_CONTENT_DIR = path.join(process.cwd(), "content", "lessons");

export function lessonMediaBase(id: string): string {
  return `/lesson-media/${id}/`;
}

export async function loadLessonManifest(id: string, root: string = LESSON_CONTENT_DIR): Promise<ManifestResult> {
  if (!LESSON_ID_RE.test(id)) return { ok: false, error: "invalid lesson id" };
  let text: string;
  try {
    text = await readFile(path.join(root, id, "lesson.json"), "utf8");
  } catch {
    return { ok: false, error: "lesson.json not found" };
  }
  return parseLessonManifest(text, { mediaBase: lessonMediaBase(id), expectedId: id });
}
