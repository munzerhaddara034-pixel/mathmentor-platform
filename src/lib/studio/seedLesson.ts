import { timelineFromScenes, type StudioSceneDocument } from "./scenes";
import { L } from "./i18n";
import type { LessonTimeline } from "./timeline";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";

/** Exact bilingual scene document requested for the studio editor default. */
export const officialExamSceneDocument: StudioSceneDocument = {
  lessonId: "leb-term-func-01",
  defaultLanguage: "en",
  title: {
    en: "Exponential Functions - Official Exam Patterns",
    fr: "Fonctions Exponentielles - Modèles d'Examens Officiels",
  },
  instructor: "Prof. Munzer Haddara",
  topic: "Exponential Functions",
  grade: "Terminale LS / GS / SE",
  track: "ls",
  scenes: [
    {
      sceneId: 1,
      audio: {
        en: "Welcome students. Today we will analyze the function f(x) = (x-1)e^x following the Lebanese official exam curriculum.",
        fr: "Bienvenue chers élèves. Aujourd'hui nous allons analyser la fonction f(x) = (x-1)e^x selon le programme officiel libanais.",
      },
      canvas: {
        type: "renderMath",
        latex: "f(x) = (x-1)e^x \\quad \\text{on } \\mathbb{R}",
      },
    },
    {
      sceneId: 2,
      audio: {
        en: "First, let's calculate the limit at minus infinity. Remember that the limit of x*e^x as x approaches minus infinity is zero.",
        fr: "Premièrement, calculons la limite en moins l'infini. Rappelez-vous que la limite de x*e^x quand x tend vers moins l'infini est égale à zéro.",
      },
      canvas: {
        type: "renderMath",
        latex: "\\lim_{x \\to -\\infty} f(x) = 0 \\implies y=0 \\text{ (Horizontal Asymptote)}",
      },
    },
    {
      sceneId: 3,
      audio: {
        en: "Now, let's plot the curve and locate the minimum point at (0, -1).",
        fr: "Maintenant, tracons la courbe et localisons le point minimum en (0, -1).",
      },
      canvas: {
        type: "plotFunction",
        expression: "(x-1)*exp(x)",
        domain: [-3, 2],
      },
    },
  ],
};

export const officialExamSceneTimeline = timelineFromScenes(officialExamSceneDocument);

/** Four-phase official-exam lesson built around the seeded scenes (EN + FR). */
export const officialExamFourPhaseLesson: LessonTimeline = {
  id: "leb-term-func-01",
  topic: "Exponential Functions",
  track: "ls",
  grade: "Terminale LS / GS / SE",
  instructor: "Prof. Munzer Haddara",
  defaultLanguage: "en",
  title: L(
    "Exponential Functions - Official Exam Patterns",
    "Fonctions Exponentielles - Modèles d'Examens Officiels",
  ),
  language: "en",
  durationSec: 240,
  media: { poster: DEMO_POSTER, videoUrl: DEMO_AVATAR_VIDEO },
  scenes: officialExamSceneDocument.scenes,
  events: [
    {
      at: 40,
      type: "fade_equation",
      latex: "f(x)=(x-1)e^x",
      payload: {
        caption: L("On the board", "Au tableau"),
      },
    },
    {
      at: 42.5,
      type: "render_graph",
      latex: "f(x)=(x-1)e^x",
      expression: "(x-1)*exp(x)",
      domain: [-3, 2],
      highlights: {
        roots: [[1, 0]],
        extrema: [[0, -1]],
        asymptotes: [{ y: 0 }],
      },
      payload: {},
    },
    {
      at: 45,
      type: "highlight_point",
      payload: {
        kind: "extrema",
        x: 0,
        y: -1,
        label: L("Minimum (0, −1)", "Minimum (0, −1)"),
      },
    },
  ],
  segments: [
    {
      id: "intro",
      start: 0,
      end: 30,
      phase: "introduction",
      label: L("1. Definition", "1. Définition"),
      avatar: { state: "speaking" },
      narration: L(
        officialExamSceneDocument.scenes[0].audio.en,
        officialExamSceneDocument.scenes[0].audio.fr,
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "fade_equation",
            latex: "f(x) = (x-1)e^x \\quad \\text{on } \\mathbb{R}",
            payload: {
              caption: L("Concept definition", "Définition"),
            },
          },
        ],
      },
    },
    {
      id: "rule-graph",
      start: 30,
      end: 90,
      phase: "rule_graph",
      label: L("2. Rule & graph", "2. Règle et graphe"),
      avatar: { state: "paused" },
      narration: L(
        `${officialExamSceneDocument.scenes[1].audio.en} ${officialExamSceneDocument.scenes[2].audio.en}`,
        `${officialExamSceneDocument.scenes[1].audio.fr} ${officialExamSceneDocument.scenes[2].audio.fr}`,
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "fade_equation",
            latex: "\\lim_{x \\to -\\infty} f(x) = 0 \\implies y=0 \\text{ (Horizontal Asymptote)}",
            payload: {
              caption: L("Limit and asymptote", "Limite et asymptote"),
            },
          },
          {
            at: 42,
            type: "show_step",
            payload: {
              latex:
                "\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ f'(x) & - & 0 & + \\\\ f & 0 & -1 & +\\infty \\end{array}",
              math_latex:
                "\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ f'(x) & - & 0 & + \\\\ f & 0 & -1 & +\\infty \\end{array}",
              step_en: "Table of variation: f decreases on (−∞, 0] and increases on [0, +∞).",
              step_fr: "Tableau de variation : f décroît sur (−∞, 0] et croît sur [0, +∞).",
              text: L(
                "Table of variation: f decreases on (−∞, 0] and increases on [0, +∞).",
                "Tableau de variation : f décroît sur (−∞, 0] et croît sur [0, +∞).",
              ),
            },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 90,
      end: 210,
      phase: "real_example",
      label: L("3. Worked example", "3. Exemple résolu"),
      avatar: { state: "speaking" },
      narration: L(
        "Calculate the derivative f'(x) using the product rule. Write u = x − 1 and v = e^x, then substitute back to prove that the minimum is at (0, −1).",
        "Calculez la dérivée f'(x) en utilisant la règle du produit. Posez u = x − 1 et v = e^x, puis substituez pour prouver que le minimum est en (0, −1).",
      ),
      canvas: {
        actions: [
          { at: 0, type: "clear", payload: {} },
          {
            at: 4,
            type: "show_equation",
            payload: {
              latex: "f(x)=(x-1)e^{x}=u v",
              math_latex: "f(x)=(x-1)e^{x}=u v",
              caption: L("Given", "Donnée"),
            },
          },
          {
            at: 18,
            type: "show_step",
            payload: {
              step_en: "Calculate the derivative f'(x) using the product rule.",
              step_fr: "Calculez la dérivée f'(x) en utilisant la règle du produit.",
              math_latex: "f'(x)=u'v+uv'=e^{x}+(x-1)e^{x}",
              latex: "f'(x)=u'v+uv'=e^{x}+(x-1)e^{x}",
              text: L(
                "Calculate the derivative f'(x) using the product rule.",
                "Calculez la dérivée f'(x) en utilisant la règle du produit.",
              ),
            },
          },
          {
            at: 48,
            type: "show_step",
            payload: {
              step_en: "Factor e^x. Then f'(x) = x e^x.",
              step_fr: "Factorisez e^x. Alors f'(x) = x e^x.",
              math_latex: "f'(x)=x e^{x}",
              latex: "f'(x)=x e^{x}",
              text: L("Factor e^x. Then f'(x) = x e^x.", "Factorisez e^x. Alors f'(x) = x e^x."),
            },
          },
          {
            at: 80,
            type: "show_step",
            payload: {
              step_en: "Critical point: f'(x)=0 gives x=0. Substitute: f(0)=(0-1)e^0=-1.",
              step_fr: "Point critique : f'(x)=0 donne x=0. Substitution : f(0)=(0-1)e^0=-1.",
              math_latex: "f'(x)=0 \\Rightarrow x=0,\\quad f(0)=-1",
              latex: "f'(x)=0 \\Rightarrow x=0,\\quad f(0)=-1",
              text: L(
                "Critical point: f'(x)=0 gives x=0. Substitute: f(0)=(0-1)e^0=-1.",
                "Point critique : f'(x)=0 donne x=0. Substitution : f(0)=(0-1)e^0=-1.",
              ),
            },
          },
        ],
      },
    },
    {
      id: "common-mistake",
      start: 210,
      end: 240,
      phase: "common_mistake",
      label: L("4. Common mistake", "4. Erreur fréquente"),
      avatar: { state: "speaking" },
      narration: L(
        "The official-exam trap: treating (x−1)e^x as a simple exponential and writing f'(x)=e^x. That forgets the product rule. Always expand u'v + uv' before you claim the minimum.",
        "Le piège d’examen : traiter (x−1)e^x comme une simple exponentielle et écrire f'(x)=e^x. On oublie la règle du produit. Développez toujours u'v + uv' avant d’affirmer le minimum.",
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "f'(x)\\neq e^{x}",
              math_latex: "f'(x)\\neq e^{x}",
              caption: L("Do not skip the product rule", "N’oubliez pas la règle du produit"),
            },
          },
          {
            at: 12,
            type: "show_step",
            payload: {
              step_en: "Correct derivative: f'(x)=x e^x. Minimum at (0, −1), not on the asymptote.",
              step_fr: "Dérivée correcte : f'(x)=x e^x. Minimum en (0, −1), pas sur l’asymptote.",
              math_latex: "f'(x)=x e^{x}\\quad \\text{min at }(0,-1)",
              latex: "f'(x)=x e^{x}\\quad \\text{min at }(0,-1)",
              text: L(
                "Correct derivative: f'(x)=x e^x. Minimum at (0, −1), not on the asymptote.",
                "Dérivée correcte : f'(x)=x e^x. Minimum en (0, −1), pas sur l’asymptote.",
              ),
            },
          },
        ],
      },
    },
  ],
};
