import { timelineFromScenes, type StudioSceneDocument } from "./scenes";
import { L, type Bilingual } from "./i18n";
import type { CanvasAction, LessonTimeline } from "./timeline";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";
import { DEFAULT_EXAM_TIP, DEFAULT_VARIATION_TABLE, INSTRUCTOR_EN } from "@/lib/pedagogy/lebanese";

function cap(en: string, fr: string): Bilingual {
  return L(en, fr);
}

function fadeEq(at: number, latex: string, captionEn: string, captionFr: string): CanvasAction {
  return {
    at,
    type: "fade_equation",
    latex,
    payload: { latex, caption: cap(captionEn, captionFr) },
  };
}

function step(at: number, latex: string, en: string, fr: string): CanvasAction {
  return {
    at,
    type: "show_step",
    payload: {
      latex,
      math_latex: latex,
      step_en: en,
      step_fr: fr,
      text: cap(en, fr),
    },
  };
}

function examTip(at: number, en: string, fr: string): CanvasAction {
  return {
    at,
    type: "exam_tip",
    payload: {
      latex: "\\text{Key Idea / Exam Tip}",
      math_latex: "\\text{Key Idea / Exam Tip}",
      caption: cap("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve"),
      step_en: en,
      step_fr: fr,
      text: cap(en, fr),
    },
  };
}

function variation(at: number, latex: string, en: string, fr: string): CanvasAction {
  return {
    at,
    type: "variationTable",
    payload: {
      latex,
      math_latex: latex,
      step_en: en,
      step_fr: fr,
      text: cap(en, fr),
    },
  };
}

function boxed(at: number, latex: string, en: string, fr: string, marks?: string): CanvasAction {
  return {
    at,
    type: "boxAnswer",
    payload: {
      latex: `\\boxed{${latex}}`,
      math_latex: `\\boxed{${latex}}`,
      step_en: en,
      step_fr: fr,
      text: cap(en, fr),
      boxed: true,
      marks,
    },
  };
}

const VARIATION_TABLE = DEFAULT_VARIATION_TABLE;

/** Compact scene document for the JSON editor; audio is full exam language, not slogans. */
export const officialExamSceneDocument: StudioSceneDocument = {
  lessonId: "leb-term-func-01",
  defaultLanguage: "en",
  title: {
    en: "Exponential Functions — Official Exam Pattern f(x)=(x−1)e^x",
    fr: "Fonctions exponentielles — modèle d’épreuve f(x)=(x−1)e^x",
  },
  instructor: INSTRUCTOR_EN,
  topic: "Exponential Functions",
  grade: "Terminale LS / GS / SE",
  track: "ls",
  scenes: [
    {
      sceneId: 1,
      audio: {
        en: DEFAULT_EXAM_TIP.en,
        fr: DEFAULT_EXAM_TIP.fr,
      },
      canvas: { type: "examTip", latex: "\\text{Key Idea / Exam Tip}" },
    },
    {
      sceneId: 2,
      audio: {
        en: "Show that D_f = R. A polynomial and e^x are defined on all of R, so the product is defined on R. Write the domain before any limit or derivative. Do not invent a restriction that is not in the text.",
        fr: "Montrer que D_f = R. Un polynôme et e^x sont définis sur R, donc le produit l’est sur R. Écrire l’ensemble de définition avant toute limite ou dérivée. On n’ajoute aucune restriction absente de l’énoncé.",
      },
      canvas: {
        type: "renderMath",
        latex: "f(x)=(x-1)e^{x},\\quad D_f=\\mathbb{R}",
      },
    },
    {
      sceneId: 3,
      audio: {
        en: "Calculate the limits at the boundaries. The limit at minus infinity is an indeterminate form of type (−∞)×0. Set t=−x. Then f(−t)=−(t+1)/e^t → 0 by growth comparison. Deduce the horizontal asymptote y=0. At plus infinity both factors tend to plus infinity.",
        fr: "Calculer les limites aux bornes. En −∞ la forme est (−∞)×0. On pose t=−x. Alors f(−t)=−(t+1)/e^t → 0 par croissance comparée. En déduire l’asymptote horizontale y=0. En +∞ les deux facteurs tendent vers +∞.",
      },
      canvas: {
        type: "renderMath",
        latex:
          "\\lim_{x\\to-\\infty}f(x)=0\\quad(y=0),\\quad \\lim_{x\\to+\\infty}f(x)=+\\infty",
      },
    },
    {
      sceneId: 4,
      audio: {
        en: "Calculate f'(x) with the product rule: u=x−1, v=e^x gives f'(x)=x e^x. The sign of f' is the sign of x. Table of variations: arrows, limits, and images. Global minimum f(0)=−1.",
        fr: "Calculer f'(x) par le produit : u=x−1, v=e^x donne f'(x)=x e^x. Le signe de f' est celui de x. Tableau de variation : flèches, limites et images. Minimum global f(0)=−1.",
      },
      canvas: { type: "variationTable", latex: VARIATION_TABLE },
    },
    {
      sceneId: 5,
      audio: {
        en: "Particular points: intercept (1,0), global minimum (0,−1), horizontal asymptote y=0. Sketch C_f accurately on the canvas.",
        fr: "Points particuliers : intercept (1,0), minimum global (0,−1), asymptote horizontale y=0. Tracer C_f avec précision.",
      },
      canvas: {
        type: "plotFunction",
        expression: "(x-1)*exp(x)",
        domain: [-3, 2],
      },
    },
    {
      sceneId: 6,
      audio: {
        en: "Deduce the number of real solutions of f(x)=−1/2. f is continuous on R. Strictly decreasing on (−∞,0], strictly increasing on [0,+∞). Intermediate Value Theorem plus monotonicity: two roots. Boxed answer: x1 in (−∞,0), x2 in (0,1).",
        fr: "En déduire le nombre de solutions de f(x)=−1/2. f est continue sur R, strictement monotone sur chaque morceau. Théorème des valeurs intermédiaires plus monotonie : deux racines. Réponse encadrée : x1 dans (−∞,0), x2 dans (0,1).",
      },
      canvas: {
        type: "boxAnswer",
        latex: "f(x)=-\\tfrac12\\Rightarrow x_1\\in(-\\infty,0),\\ x_2\\in(0,1)",
      },
    },
    {
      sceneId: 7,
      audio: {
        en: "Common pitfalls that lose barème marks: writing (−∞)×0=0, writing f'(x)=e^x, or applying the Intermediate Value Theorem without continuity and monotonicity.",
        fr: "Pièges fréquents (barème) : écrire (−∞)×0=0, écrire f'(x)=e^x, ou appliquer le théorème des valeurs intermédiaires sans continuité ni monotonie.",
      },
      canvas: {
        type: "renderMath",
        latex: "f'(x)=xe^{x}\\neq e^{x}",
      },
    },
  ],
};

export const officialExamSceneTimeline = timelineFromScenes(officialExamSceneDocument);

/** Full Terminale English-section study used by `/lessons/interactive`. */
export const officialExamFourPhaseLesson: LessonTimeline = {
  id: "leb-term-func-01",
  topic: "Exponential Functions",
  track: "ls",
  grade: "Terminale LS / GS / SE",
  instructor: INSTRUCTOR_EN,
  defaultLanguage: "en",
  title: L(
    "Exponential Functions — Official Exam Pattern f(x)=(x−1)e^x",
    "Fonctions exponentielles — modèle d’épreuve f(x)=(x−1)e^x",
  ),
  language: "en",
  durationSec: 380,
  media: { poster: DEMO_POSTER, videoUrl: DEMO_AVATAR_VIDEO },
  chapters: [
    { id: "intro", at: 0, label: L("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve") },
    { id: "domain", at: 18, label: L("Domain D_f", "Ensemble D_f") },
    { id: "limits", at: 55, label: L("Limits & asymptotes", "Limites et asymptotes") },
    { id: "derivative", at: 100, label: L("Derivative", "Dérivée") },
    { id: "variation", at: 118, label: L("Variation table", "Tableau de variation") },
    { id: "quiz", at: 145, label: L("Quiz", "Quiz") },
    { id: "graph", at: 158, label: L("Points & graph", "Points et graphe") },
    { id: "example", at: 175, label: L("Boxed exercise", "Exercice encadré") },
    { id: "mistake", at: 335, label: L("Common pitfalls", "Pièges fréquents") },
  ],
  scenes: officialExamSceneDocument.scenes,
  events: [
    {
      at: 152,
      type: "fade_equation",
      latex: "f(x)=(x-1)e^{x}",
      payload: { caption: cap("On the board", "Au tableau") },
    },
    {
      at: 158,
      type: "plotFunction",
      latex: "f(x)=(x-1)e^{x}",
      expression: "(x-1)*exp(x)",
      domain: [-3, 2],
      highlights: {
        roots: [[1, 0]],
        extrema: [[0, -1]],
        asymptotes: [{ y: 0 }],
      },
      payload: {
        kind: "function",
        fn: "(x-1)*exp(x)",
        xDomain: [-3, 2],
        yDomain: [-4, 8],
        title: cap("C_f : y = (x−1)e^x", "C_f : y = (x−1)e^x"),
      },
    },
    {
      at: 145,
      type: "quiz_mcq",
      payload: {
        id: "leb-term-func-01-derivative",
        question: cap(
          "After the product rule, what is the simplified derivative f'(x)?",
          "Après la règle du produit, quelle est la dérivée simplifiée f'(x) ?",
        ),
        choices: [
          { id: "a", text: cap("e^{x}", "e^{x}") },
          { id: "b", text: cap("x e^{x}", "x e^{x}") },
          { id: "c", text: cap("(x-1)e^{x}", "(x-1)e^{x}") },
          { id: "d", text: cap("e^{x}+1", "e^{x}+1") },
        ],
        correctId: "b",
        explanation: cap(
          "u=x−1, v=e^x ⇒ f'=e^x+(x−1)e^x=x e^x. The trap e^x treats (x−1) as a constant.",
          "u=x−1, v=e^x ⇒ f'=e^x+(x−1)e^x=x e^x. Le piège e^x traite (x−1) comme une constante.",
        ),
      },
    },
    {
      at: 165,
      type: "highlight_point",
      payload: {
        kind: "extrema",
        x: 0,
        y: -1,
        label: cap("Global minimum (0, −1)", "Minimum global (0, −1)"),
      },
    },
  ],
  segments: [
    {
      id: "intro",
      start: 0,
      end: 55,
      phase: "introduction",
      label: L("1. Key Idea & domain D_f", "1. Idée clé et ensemble D_f"),
      avatar: { state: "speaking" },
      narration: L(
        `${DEFAULT_EXAM_TIP.en} This is a Lebanese Terminale pattern — Life Sciences, General Sciences, and Sociology-Economics. Let f(x)=(x−1)e^x. Show that D_f = R: a polynomial and the exponential are defined on all real numbers. Never invent a restriction. Domain comes before any limit or derivative.`,
        `${DEFAULT_EXAM_TIP.fr} C’est un modèle d’épreuve libanaise de Terminale — SV, SG et SES. Soit f(x)=(x−1)e^x. Montrer que D_f = R : un polynôme et l’exponentielle sont définis sur R. On n’ajoute aucune restriction. L’ensemble de définition précède toute limite ou dérivée.`,
      ),
      canvas: {
        actions: [
          examTip(1, DEFAULT_EXAM_TIP.en, DEFAULT_EXAM_TIP.fr),
          fadeEq(12, "f(x)=(x-1)e^{x}", "Given function", "Fonction donnée"),
          step(
            20,
            "D_f=\\mathbb{R}",
            "Show that D_f = R: polynomials and e^x are defined on R, so the product is defined on R.",
            "Montrer que D_f = R : les polynômes et e^x sont définis sur R, donc le produit l’est aussi.",
          ),
          boxed(
            40,
            "D_f=\\mathbb{R}",
            "Boxed Final Answer (domain sub-question): D_f = R.",
            "Réponse encadrée (ensemble de définition) : D_f = R.",
            "domain",
          ),
        ],
      },
    },
    {
      id: "rule-graph",
      start: 55,
      end: 175,
      phase: "rule_graph",
      label: L("2. Limits, variation, graph", "2. Limites, variation, graphe"),
      avatar: { state: "paused" },
      narration: L(
        "Look at the board. Calculate the limits at the boundaries. At minus infinity the form is (−∞)×0: set t=−x, rewrite as −(t+1)/e^t, growth comparison gives 0. Deduce the horizontal asymptote y=0 — write the equation, not only the word. At plus infinity f tends to plus infinity. Product rule: u=x−1, v=e^x gives f'(x)=x e^x. Table of variations with arrows, limits, and images. Particular points: (1,0), (0,−1). Sketch C_f.",
        "Regardez le tableau. Calculer les limites aux bornes. En −∞ la forme est (−∞)×0 : t=−x, −(t+1)/e^t → 0. En déduire y=0. En +∞, f → +∞. Règle du produit : f'(x)=x e^x. Tableau de variation avec flèches, limites et images. Points : (1,0), (0,−1). Tracer C_f.",
      ),
      canvas: {
        actions: [
          fadeEq(
            2,
            "\\lim_{x\\to-\\infty}(x-1)e^{x}\\quad\\text{type }(-\\infty)\\times 0",
            "Do not conclude yet",
            "Ne pas conclure trop tôt",
          ),
          step(
            12,
            "t=-x:\\quad f(-t)=-\\dfrac{t+1}{e^{t}}\\xrightarrow[t\\to+\\infty]{}0",
            "Calculate: rewrite as a quotient. Growth comparison: t^n / e^t → 0 for every n.",
            "Calculer : réécrire en quotient. Croissance comparée : t^n / e^t → 0 pour tout n.",
          ),
          boxed(
            32,
            "\\lim_{x\\to-\\infty}f(x)=0,\\ y=0",
            "Boxed: horizontal asymptote y=0 as x → −∞. Write the equation y=0, not only “asymptote”.",
            "Encadré : asymptote horizontale y=0 lorsque x → −∞. Écrire l’équation y=0.",
            "limits",
          ),
          step(
            48,
            "\\lim_{x\\to+\\infty}f(x)=+\\infty",
            "Calculate: as x → +∞, x−1 → +∞ and e^x → +∞, so the product → +∞. No horizontal asymptote at +∞.",
            "Calculer : lorsque x → +∞ le produit → +∞. Pas d’asymptote horizontale en +∞.",
          ),
          step(
            62,
            "u=x-1,\\; u'=1,\\; v=e^{x},\\; v'=e^{x}",
            "Calculate f': name u and v before differentiating (product rule).",
            "Calculer f' : nommer u et v avant de dériver (règle du produit).",
          ),
          step(
            78,
            "f'=u'v+uv'=e^{x}+(x-1)e^{x}=e^{x}\\bigl(1+x-1\\bigr)=xe^{x}",
            "Every algebra step: expand, factor e^x, simplify the bracket to x.",
            "Chaque étape : développer, factoriser e^x, le crochet se réduit à x.",
          ),
          variation(
            96,
            VARIATION_TABLE,
            "Table of variations: f' has the sign of x. Arrows, limits, and images. Global min f(0)=−1. Root: (x−1)e^x=0 ⇒ x=1.",
            "Tableau de variation : f' a le signe de x. Flèches, limites et images. Min global f(0)=−1. Racine x=1.",
          ),
          {
            at: 112,
            type: "plotFunction",
            latex: "f(x)=(x-1)e^{x}",
            expression: "(x-1)*exp(x)",
            domain: [-3, 2],
            highlights: {
              roots: [[1, 0]],
              extrema: [[0, -1]],
              asymptotes: [{ y: 0 }],
            },
            payload: {
              kind: "function",
              fn: "(x-1)*exp(x)",
              expression: "(x-1)*exp(x)",
              xDomain: [-3, 2],
              yDomain: [-4, 8],
              title: cap("C_f : y = (x−1)e^x", "C_f : y = (x−1)e^x"),
            },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 175,
      end: 335,
      phase: "real_example",
      label: L("3. Official exercise (boxed)", "3. Exercice d’épreuve (encadré)"),
      avatar: { state: "speaking" },
      narration: L(
        "Exam-style exercise. After the study of f, determine the number of real solutions of f(x)=m, then solve f(x)=−1/2. f is continuous on R. Strictly decreasing on (−∞,0], strictly increasing on [0,+∞). Intermediate Value Theorem / Théorème des valeurs intermédiaires applies only after continuity and monotonicity. For m=−1/2 ∈ (−1,0) deduce exactly two roots. Box each sub-question.",
        "Exercice type. Après l’étude, le nombre de solutions de f(x)=m, puis f(x)=−1/2. f est continue sur R, strictement monotone sur chaque morceau. Le théorème des valeurs intermédiaires n’est licite qu’après continuité et monotonie. Pour m=−1/2 ∈ (−1,0), deux racines. Encadrer chaque sous-question.",
      ),
      canvas: {
        actions: [
          { at: 0, type: "clear", payload: {} },
          fadeEq(4, "\\text{Solve }f(x)=m\\text{ and }f(x)=-\\tfrac12", "Official wording", "Énoncé type"),
          step(
            16,
            "f\\text{ continuous on }\\mathbb{R}",
            "Show that f is continuous on R (product of continuous functions) before any Intermediate Value Theorem.",
            "Montrer que f est continue sur R (produit de fonctions continues) avant tout théorème des valeurs intermédiaires.",
          ),
          step(
            40,
            "f\\bigl((−\\infty,0]\\bigr)=[-1,0),\\quad f\\bigl([0,+\\infty)\\bigr)=[-1,+\\infty)",
            "Deduce the range from the table: strictly monotone on each piece, so the image of each interval is an interval.",
            "En déduire l’image sur le tableau : monotonie stricte sur chaque morceau, donc l’image de chaque intervalle est un intervalle.",
          ),
          boxed(
            72,
            "m<-1:\\emptyset,\\ m=-1:\\{0\\},\\ m\\ge 0:\\text{one root},\\ -1<m<0:\\text{two roots}",
            "Boxed Final Answer (number of solutions): read from the table, not guessed. Barème: discussion in m.",
            "Réponse encadrée (nombre de solutions) : lue sur le tableau. Barème : discussion en m.",
            "discussion in m",
          ),
          step(
            100,
            "f(0)=-1,\\quad f(1)=0,\\quad -1<-\\tfrac12<0",
            "Calculate: f(0)=−1 and f(1)=0 pin −1/2 between the minimum and the root. Continuity + monotonicity ⇒ unique root on each piece.",
            "Calculer : f(0)=−1 et f(1)=0 encadrent −1/2. Continuité + monotonie ⇒ une racine unique sur chaque morceau.",
          ),
          boxed(
            132,
            "x_1\\in(-\\infty,0),\\ x_2\\in(0,1)",
            "Boxed Final Answer: f(x)=−1/2 has exactly two real solutions (IVT + strict monotonicity). No closed form unless the paper asks to solve numerically.",
            "Réponse encadrée : f(x)=−1/2 a exactement deux solutions réelles (TVI + monotonie stricte).",
            "f(x)=-1/2",
          ),
        ],
      },
    },
    {
      id: "common-mistake",
      start: 335,
      end: 380,
      phase: "common_mistake",
      label: L("4. Common pitfalls (barème)", "4. Pièges fréquents (barème)"),
      avatar: { state: "speaking" },
      narration: L(
        "Common pitfalls that lose barème marks. First: writing (−∞)×0=0 without rewriting as −(t+1)/e^t. Second: treating (x−1) as a constant and writing f'(x)=e^x. Third: applying the Intermediate Value Theorem without continuity and monotonicity. Correct: f'(x)=x e^x, min (0,−1), asymptote y=0.",
        "Pièges fréquents (barème). Premier : écrire (−∞)×0=0 sans −(t+1)/e^t. Second : f'(x)=e^x. Troisième : TVI sans continuité ni monotonie. Correct : f'(x)=x e^x, min (0,−1), y=0.",
      ),
      canvas: {
        actions: [
          fadeEq(2, "(-\\infty)\\times 0\\;\\text{ is not a value}", "Wrong shortcut", "Raccourci faux"),
          step(
            10,
            "f'(x)\\neq e^{x}",
            "Wrong: skip the product rule, or apply IVT without hypotheses. Correct: f'(x)=x e^x, min at (0,−1), not on y=0.",
            "Faux : sauter le produit, ou TVI sans hypothèses. Correct : f'(x)=x e^x, min en (0,−1).",
          ),
          boxed(
            28,
            "f'(x)=xe^{x},\\ \\min(0,-1),\\ y=0",
            "Box the three facts the paper marks: derivative, minimum, asymptote equation y=0. They are three different objects.",
            "Encadrer les trois faits notés : dérivée, minimum, équation d’asymptote y=0.",
            "trap correction",
          ),
        ],
      },
    },
  ],
};
