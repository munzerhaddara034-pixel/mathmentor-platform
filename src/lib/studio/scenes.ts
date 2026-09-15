import { L, type Bilingual } from "./i18n";

type LessonPhase = "introduction" | "rule_graph" | "real_example" | "common_mistake";

export const canvasSceneTypeSchema = ["renderMath", "plotFunction"] as const;
export type CanvasSceneType = (typeof canvasSceneTypeSchema)[number];

export type StudioSceneCanvas =
  | { type: "renderMath"; latex: string }
  | { type: "plotFunction"; expression: string; domain?: [number, number] };

export type StudioScene = {
  sceneId: number;
  audio: { en: string; fr: string };
  canvas: StudioSceneCanvas;
};

export type StudioSceneDocument = {
  lessonId: string;
  defaultLanguage: "en" | "fr";
  title: { en: string; fr: string };
  instructor?: string;
  scenes: StudioScene[];
  topic?: string;
  grade?: string;
  track?: string;
};

export function isSceneDocument(value: unknown): value is StudioSceneDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.scenes) && typeof record.lessonId === "string";
}

function durationFor(audio: { en: string; fr: string }) {
  const words = Math.max(audio.en.split(/\s+/).length, audio.fr.split(/\s+/).length);
  return Math.max(20, Math.min(48, Math.round(words / 2.1) + 8));
}

function phaseForScene(index: number, total: number): LessonPhase {
  if (index === 0) return "introduction";
  if (total === 1) return "introduction";
  const plotLike = index === total - 1 && total <= 3;
  if (plotLike || index === 1) return "rule_graph";
  if (index === total - 1) return "common_mistake";
  return "real_example";
}

function sceneLabel(scene: StudioScene, index: number): Bilingual {
  if (scene.canvas.type === "plotFunction") {
    return L(`${index + 1}. Graph`, `${index + 1}. Graphe`);
  }
  if (index === 0) return L(`${index + 1}. Definition`, `${index + 1}. Définition`);
  return L(`${index + 1}. Rule`, `${index + 1}. Règle`);
}

export function timelineFromScenes(doc: StudioSceneDocument) {
  let cursor = 0;
  const segments = doc.scenes.map((scene, index) => {
    const duration = durationFor(scene.audio);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    const phase = phaseForScene(index, doc.scenes.length);
    const canvas = scene.canvas;
    const plot = canvas.type === "plotFunction";
    return {
      id: `scene-${scene.sceneId}`,
      start,
      end,
      phase,
      label: sceneLabel(scene, index),
      avatar: { state: plot ? ("paused" as const) : ("speaking" as const) },
      narration: L(scene.audio.en, scene.audio.fr),
      canvas: {
        actions:
          canvas.type === "plotFunction"
            ? [
                {
                  at: 2,
                  type: "render_graph" as const,
                  payload: {
                    kind: "function",
                    fn: canvas.expression,
                    expression: canvas.expression,
                    domain: canvas.domain,
                    xDomain: canvas.domain ?? [-3, 2],
                    yDomain: [-4, 8],
                    title: L("y = (x-1)e^x", "y = (x-1)e^x"),
                    points: [{ x: 0, y: -1, kind: "extrema", label: L("min (0, −1)", "min (0, −1)") }],
                  },
                },
                {
                  at: 8,
                  type: "highlight_point" as const,
                  payload: {
                    kind: "extrema",
                    x: 0,
                    y: -1,
                    label: L("Minimum (0, −1)", "Minimum (0, −1)"),
                  },
                },
                {
                  at: 12,
                  type: "highlight_point" as const,
                  payload: {
                    kind: "asymptote",
                    axis: "y",
                    value: 0,
                    label: L("Horizontal asymptote y = 0", "Asymptote horizontale y = 0"),
                  },
                },
              ]
            : [
                {
                  at: 1,
                  type: "show_equation" as const,
                  payload: {
                    latex: canvas.latex,
                    math_latex: canvas.latex,
                    caption: L("On the board", "Au tableau"),
                  },
                },
              ],
      },
    };
  });

  return {
    id: doc.lessonId,
    topic: doc.topic ?? doc.title.en,
    track: "ls" as const,
    grade: doc.grade ?? "Terminale LS / GS / SE",
    instructor: doc.instructor,
    title: L(doc.title.en, doc.title.fr),
    language: doc.defaultLanguage,
    defaultLanguage: doc.defaultLanguage,
    durationSec: Math.max(1, cursor),
    media: { poster: "/teachers/munzer.jpg" },
    scenes: doc.scenes,
    segments,
  };
}
