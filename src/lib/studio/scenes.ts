import { L, type Bilingual } from "./i18n";

type LessonPhase = "introduction" | "rule_graph" | "real_example" | "common_mistake";

export const canvasSceneTypeSchema = ["renderMath", "plotFunction", "variationTable", "boxAnswer", "examTip"] as const;
export type CanvasSceneType = (typeof canvasSceneTypeSchema)[number];

export type StudioSceneCanvas =
  | { type: "renderMath"; latex: string }
  | { type: "plotFunction"; expression: string; domain?: [number, number] }
  | { type: "variationTable"; latex: string }
  | { type: "boxAnswer"; latex: string }
  | { type: "examTip"; latex?: string };

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

function phaseForScene(index: number, total: number, scene: StudioScene): LessonPhase {
  if (index <= 1 || scene.canvas.type === "examTip") return "introduction";
  if (index === total - 1) return "common_mistake";
  if (scene.canvas.type === "plotFunction" || scene.canvas.type === "variationTable") return "rule_graph";
  if (scene.canvas.type === "boxAnswer") return "real_example";
  if (index < Math.max(2, Math.ceil(total * 0.55))) return "rule_graph";
  return "real_example";
}

function sceneLabel(scene: StudioScene, index: number): Bilingual {
  if (scene.canvas.type === "examTip") return L(`${index + 1}. Key Idea / Exam Tip`, `${index + 1}. Idée clé / Conseil d’épreuve`);
  if (scene.canvas.type === "plotFunction") return L(`${index + 1}. Points & graph`, `${index + 1}. Points et graphe`);
  if (scene.canvas.type === "variationTable") return L(`${index + 1}. Table of variations`, `${index + 1}. Tableau de variation`);
  if (scene.canvas.type === "boxAnswer") return L(`${index + 1}. Boxed answer`, `${index + 1}. Réponse encadrée`);
  if (index === 0) return L(`${index + 1}. Domain D_f`, `${index + 1}. Ensemble D_f`);
  return L(`${index + 1}. Rule`, `${index + 1}. Règle`);
}

export function timelineFromScenes(doc: StudioSceneDocument) {
  let cursor = 0;
  const segments = doc.scenes.map((scene, index) => {
    const duration = durationFor(scene.audio);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    const phase = phaseForScene(index, doc.scenes.length, scene);
    const canvas = scene.canvas;
    const plot = canvas.type === "plotFunction";
    const actions =
      canvas.type === "plotFunction"
        ? [
            {
              at: 2,
              type: "plotFunction" as const,
              latex: "f(x)=(x-1)e^{x}",
              expression: canvas.expression,
              domain: canvas.domain ?? [-3, 2],
              highlights: {
                roots: [[1, 0]],
                extrema: [[0, -1]],
                asymptotes: [{ y: 0 }],
              },
              payload: {
                kind: "function",
                fn: canvas.expression,
                expression: canvas.expression,
                domain: canvas.domain,
                xDomain: canvas.domain ?? [-3, 2],
                yDomain: [-4, 8],
                title: L("y = (x-1)e^x", "y = (x-1)e^x"),
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
        : canvas.type === "variationTable"
          ? [
              {
                at: 2,
                type: "variationTable" as const,
                latex: canvas.latex,
                payload: {
                  latex: canvas.latex,
                  math_latex: canvas.latex,
                  caption: L("Table of variations", "Tableau de variation"),
                },
              },
            ]
          : canvas.type === "boxAnswer"
            ? [
                {
                  at: 2,
                  type: "boxAnswer" as const,
                  latex: canvas.latex,
                  payload: {
                    latex: canvas.latex,
                    math_latex: canvas.latex,
                    caption: L("Boxed Final Answer", "Réponse encadrée"),
                  },
                },
              ]
            : canvas.type === "examTip"
              ? [
                  {
                    at: 1,
                    type: "exam_tip" as const,
                    latex: canvas.latex || "\\text{Key Idea / Exam Tip}",
                    payload: {
                      latex: canvas.latex || "\\text{Key Idea / Exam Tip}",
                      caption: L("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve"),
                    },
                  },
                ]
              : [
                  {
                    at: 1,
                    type: "renderMath" as const,
                    latex: canvas.latex,
                    payload: {
                      caption: L("On the board", "Au tableau"),
                    },
                  },
                ];
    return {
      id: `scene-${scene.sceneId}`,
      start,
      end,
      phase,
      label: sceneLabel(scene, index),
      avatar: { state: plot || canvas.type === "variationTable" ? ("paused" as const) : ("speaking" as const) },
      narration: L(scene.audio.en, scene.audio.fr),
      canvas: { actions },
    };
  });

  return {
    id: doc.lessonId,
    topic: doc.topic ?? doc.title.en,
    track: "ls" as const,
    grade: doc.grade ?? "Terminale LS / GS / SE",
    instructor: doc.instructor ?? "Prof. Munzer Haddara",
    title: L(doc.title.en, doc.title.fr),
    language: doc.defaultLanguage,
    defaultLanguage: doc.defaultLanguage,
    durationSec: Math.max(1, cursor),
    media: { poster: "/teachers/munzer.jpg", videoUrl: "/studio/demo-avatar.mp4" },
    scenes: doc.scenes,
    segments,
  };
}
