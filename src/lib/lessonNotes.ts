export type NoteBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "math"; tex: string }
  | { type: "ul"; items: string[] }
  | { type: "example"; title: string; given: string; tex?: string; steps: string[]; result: string }
  | { type: "mistake"; title: string; wrong: string; right: string };

export type LessonLang = "en" | "fr";

export const DEFAULT_LESSON_LANG: LessonLang = "en";

export function isLessonLang(value: string | null | undefined): value is LessonLang {
  return value === "en" || value === "fr";
}
