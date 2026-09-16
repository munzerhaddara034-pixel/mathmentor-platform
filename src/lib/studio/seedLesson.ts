import { timelineFromScenes, type StudioSceneDocument } from "./scenes";
import { L, type Bilingual } from "./i18n";
import type { CanvasAction, LessonTimeline } from "./timeline";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";

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

/** Compact scene document for the JSON editor; audio is full exam language, not slogans. */
export const officialExamSceneDocument: StudioSceneDocument = {
  lessonId: "leb-term-func-01",
  defaultLanguage: "en",
  title: {
    en: "Exponential Functions — Official Exam Pattern f(x)=(x−1)e^x",
    fr: "Fonctions exponentielles — modèle d’épreuve f(x)=(x−1)e^x",
  },
  instructor: "Prof. Munzer Haddara",
  topic: "Exponential Functions",
  grade: "Terminale LS / GS / SE",
  track: "ls",
  scenes: [
    {
      sceneId: 1,
      audio: {
        en: "Terminale LS, GS and SE papers treat the product of a linear factor and an exponential as a full study: domain, both limits, derivative, table of variation, sketch. Let f(x)=(x−1)e^x. A polynomial and e^x are defined on all of R, so the domain is R. Do not invent a restriction that is not in the text.",
        fr: "Les épreuves de Terminale SV, SG et SES traitent le produit d’un facteur affine et d’une exponentielle comme une étude complète : ensemble de définition, les deux limites, dérivée, tableau de variation, allure. Soit f(x)=(x−1)e^x. Un polynôme et e^x sont définis sur R, donc D_f = R. On n’ajoute aucune restriction absente de l’énoncé.",
      },
      canvas: {
        type: "renderMath",
        latex: "f(x)=(x-1)e^{x},\\quad D_f=\\mathbb{R}",
      },
    },
    {
      sceneId: 2,
      audio: {
        en: "The limit at minus infinity is an indeterminate form of type (−∞)×0. Set t=−x, so as x goes to minus infinity, t goes to plus infinity. Then f(−t)=−(t+1)e^{−t}=−(t+1)/e^t. Growth comparison: any polynomial over e^t tends to 0. Hence the limit is 0 and y=0 is a horizontal asymptote at minus infinity.",
        fr: "La limite en −∞ est une forme indéterminée du type (−∞)×0. On pose t=−x : lorsque x tend vers −∞, t tend vers +∞. Alors f(−t)=−(t+1)e^{−t}=−(t+1)/e^t. Croissance comparée : tout polynôme sur e^t tend vers 0. Donc la limite vaut 0 et y=0 est asymptote horizontale en −∞.",
      },
      canvas: {
        type: "renderMath",
        latex:
          "\\lim_{x\\to-\\infty}f(x)=0\\quad(y=0\\text{ asymptote}),\\quad \\lim_{x\\to+\\infty}f(x)=+\\infty",
      },
    },
    {
      sceneId: 3,
      audio: {
        en: "Product rule: u=x−1, u'=1, v=e^x, v'=e^x. Then f'=u'v+uv'=e^x+(x−1)e^x. Factor e^x: f'(x)=x e^x. e^x is never zero, so the only critical point is x=0, and f(0)=−1. Look at the board: root at (1,0), global minimum at (0,−1), asymptote y=0.",
        fr: "Règle du produit : u=x−1, u'=1, v=e^x, v'=e^x. Alors f'=u'v+uv'=e^x+(x−1)e^x. On factorise e^x : f'(x)=x e^x. e^x ne s’annule jamais, donc le seul point critique est x=0, et f(0)=−1. Regardez le tableau : racine en (1,0), minimum global en (0,−1), asymptote y=0.",
      },
      canvas: {
        type: "plotFunction",
        expression: "(x-1)*exp(x)",
        domain: [-3, 2],
      },
    },
    {
      sceneId: 4,
      audio: {
        en: "Official exercise: how many real solutions has f(x)=−1/2? The range of f is [−1,+∞). Since −1/2 lies strictly between −1 and 0, the table of variation gives exactly two roots: one in (−∞,0) and one in (0,1), because f(1)=0.",
        fr: "Exercice type : combien de solutions réelles pour f(x)=−1/2 ? L’image de f est [−1,+∞). Comme −1/2 est strictement entre −1 et 0, le tableau de variation donne exactement deux racines : une dans (−∞,0) et une dans (0,1), car f(1)=0.",
      },
      canvas: {
        type: "renderMath",
        latex: "f(x)=-\\tfrac12\\quad\\text{has two real roots}",
      },
    },
    {
      sceneId: 5,
      audio: {
        en: "Exam trap: writing (−∞)×0=0, or writing f'(x)=e^x as if the linear factor were constant. Both score zero. Rewrite the limit as a quotient, and expand u'v+uv' before you box the minimum.",
        fr: "Piège d’épreuve : écrire (−∞)×0=0, ou écrire f'(x)=e^x comme si le facteur affine était constant. Les deux sont notés zéro. On réécrit la limite en quotient, et on développe u'v+uv' avant d’encadrer le minimum.",
      },
      canvas: {
        type: "renderMath",
        latex: "f'(x)=xe^{x}\\neq e^{x}",
      },
    },
  ],
};

export const officialExamSceneTimeline = timelineFromScenes(officialExamSceneDocument);

const VARIATION_TABLE =
  "\\begin{array}{c|ccc} x & -\\infty & 0 & +\\infty \\\\ f'(x) & - & 0 & + \\\\ f & 0 & -1 & +\\infty \\end{array}";

/** Full Terminale English-section study used by `/lessons/interactive`. */
export const officialExamFourPhaseLesson: LessonTimeline = {
  id: "leb-term-func-01",
  topic: "Exponential Functions",
  track: "ls",
  grade: "Terminale LS / GS / SE",
  instructor: "Prof. Munzer Haddara",
  defaultLanguage: "en",
  title: L(
    "Exponential Functions — Official Exam Pattern f(x)=(x−1)e^x",
    "Fonctions exponentielles — modèle d’épreuve f(x)=(x−1)e^x",
  ),
  language: "en",
  durationSec: 360,
  media: { poster: DEMO_POSTER, videoUrl: DEMO_AVATAR_VIDEO },
  scenes: officialExamSceneDocument.scenes,
  events: [
    {
      at: 145,
      type: "fade_equation",
      latex: "f(x)=(x-1)e^{x}",
      payload: { caption: cap("On the board", "Au tableau") },
    },
    {
      at: 150,
      type: "render_graph",
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
        title: cap("y = (x−1)e^x", "y = (x−1)e^x"),
      },
    },
    {
      at: 138,
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
      at: 155,
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
      end: 50,
      phase: "introduction",
      label: L("1. Exam framing & domain", "1. Cadre d’épreuve et ensemble de définition"),
      avatar: { state: "speaking" },
      narration: L(
        "This is a Lebanese Terminale pattern — Life Sciences, General Sciences, and Sociology-Economics. Official papers ask for a complete study of a product of a linear factor and an exponential: domain, both limits with justification, the derivative, the table of variation, and a sketch. Let f be defined by f(x)=(x−1)e^x. A polynomial and the exponential function are defined on all real numbers, so the domain is R. Never invent a restriction that is not written in the text.",
        "C’est un modèle d’épreuve libanaise de Terminale — Sciences de la Vie, Sciences Générales et SES. Les sujets officiels demandent l’étude complète d’un produit d’un facteur affine et d’une exponentielle : ensemble de définition, les deux limites justifiées, la dérivée, le tableau de variation et une allure. Soit f définie par f(x)=(x−1)e^x. Un polynôme et la fonction exponentielle sont définis sur R, donc D_f = R. On n’ajoute aucune restriction absente de l’énoncé.",
      ),
      canvas: {
        actions: [
          fadeEq(2, "f(x)=(x-1)e^{x}", "Given function", "Fonction donnée"),
          step(
            12,
            "D_f=\\mathbb{R}",
            "Polynomials and e^x are defined on R, so the product is defined on R.",
            "Les polynômes et e^x sont définis sur R, donc le produit l’est aussi.",
          ),
          step(
            28,
            "\\text{LS / GS / SE: study }+\\text{ sketch }+\\text{ equation }f(x)=m",
            "What the paper actually marks: domain, limits, f', table, graph, then an equation in m.",
            "Ce que le barème note : D_f, limites, f', tableau, graphe, puis une équation en m.",
          ),
        ],
      },
    },
    {
      id: "rule-graph",
      start: 50,
      end: 160,
      phase: "rule_graph",
      label: L("2. Limits, derivative, graph", "2. Limites, dérivée, graphe"),
      avatar: { state: "paused" },
      narration: L(
        "Look at the board. The limit at minus infinity is indeterminate of type (−∞)×0. Set t=−x. Then f(−t)=−(t+1)/e^t, which tends to 0 by growth comparison. At plus infinity both factors tend to plus infinity, so f tends to plus infinity. Product rule: u=x−1, v=e^x gives f'(x)=x e^x. The sign of f' is the sign of x. Table of variation: f decreases from 0 to −1 on (−∞,0], then increases to plus infinity. Horizontal asymptote y=0, root (1,0), global minimum (0,−1).",
        "Regardez le tableau. La limite en −∞ est indéterminée du type (−∞)×0. On pose t=−x. Alors f(−t)=−(t+1)/e^t, qui tend vers 0 par croissance comparée. En +∞ les deux facteurs tendent vers +∞, donc f tend vers +∞. Règle du produit : u=x−1, v=e^x donne f'(x)=x e^x. Le signe de f' est celui de x. Tableau de variation : f décroît de 0 à −1 sur (−∞,0], puis croît vers +∞. Asymptote y=0, racine (1,0), minimum global (0,−1).",
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
            14,
            "t=-x:\\quad f(-t)=-\\dfrac{t+1}{e^{t}}\\xrightarrow[t\\to+\\infty]{}0",
            "Rewrite as a quotient. Growth comparison: t^n / e^t → 0 for every n.",
            "On réécrit en quotient. Croissance comparée : t^n / e^t → 0 pour tout n.",
          ),
          step(
            32,
            "\\lim_{x\\to-\\infty}f(x)=0,\\quad y=0\\text{ horizontal asymptote}",
            "Hence y=0 is a horizontal asymptote as x → −∞.",
            "Donc y=0 est asymptote horizontale lorsque x → −∞.",
          ),
          step(
            48,
            "\\lim_{x\\to+\\infty}f(x)=+\\infty",
            "As x → +∞, x−1 → +∞ and e^x → +∞, so the product → +∞.",
            "Lorsque x → +∞, x−1 → +∞ et e^x → +∞, donc le produit → +∞.",
          ),
          step(
            62,
            "u=x-1,\\; u'=1,\\; v=e^{x},\\; v'=e^{x}",
            "Proof sketch of the derivative: name u and v before differentiating.",
            "Esquisse de preuve de la dérivée : on nomme u et v avant de dériver.",
          ),
          step(
            78,
            "f'=u'v+uv'=e^{x}+(x-1)e^{x}=e^{x}\\bigl(1+x-1\\bigr)=xe^{x}",
            "Every algebra step: expand, factor e^x, simplify the bracket to x.",
            "Chaque étape : on développe, on factorise e^x, le crochet se réduit à x.",
          ),
          step(
            92,
            VARIATION_TABLE,
            "f' has the sign of x. f decreases on (−∞,0] and increases on [0,+∞). Global min f(0)=−1. Root: (x−1)e^x=0 ⇒ x=1.",
            "f' a le signe de x. f décroît sur (−∞,0] et croît sur [0,+∞). Min global f(0)=−1. Racine : (x−1)e^x=0 ⇒ x=1.",
          ),
          {
            at: 100,
            type: "render_graph",
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
              title: cap("y = (x−1)e^x", "y = (x−1)e^x"),
            },
          },
        ],
      },
    },
    {
      id: "real-example",
      start: 160,
      end: 320,
      phase: "real_example",
      label: L("3. Official exercise", "3. Exercice d’épreuve"),
      avatar: { state: "speaking" },
      narration: L(
        "Exam-style exercise. After the study of f, determine the number of real solutions of f(x)=m, then solve f(x)=−1/2. From the table, the range is [−1,+∞). If m is less than −1 there is no solution. If m equals −1 there is exactly one solution, x=0. If m is greater than or equal to 0 there is exactly one solution, on [1,+∞). If m is strictly between −1 and 0 there are two solutions. For m=−1/2, factor nothing extra: read the table, compare with f(1)=0, and conclude one root in (−∞,0) and one in (0,1).",
        "Exercice type d’épreuve. Après l’étude de f, déterminer le nombre de solutions réelles de f(x)=m, puis traiter f(x)=−1/2. D’après le tableau, l’image est [−1,+∞). Si m<−1, aucune solution. Si m=−1, une seule solution x=0. Si m≥0, une seule solution, dans [1,+∞). Si −1<m<0, deux solutions. Pour m=−1/2, on ne factorise rien de plus : on lit le tableau, on compare à f(1)=0, et on conclut une racine dans (−∞,0) et une dans (0,1).",
      ),
      canvas: {
        actions: [
          { at: 0, type: "clear", payload: {} },
          fadeEq(4, "\\text{Solve }f(x)=m\\text{ and }f(x)=-\\tfrac12", "Official wording", "Énoncé type"),
          step(
            16,
            "f\\bigl((−\\infty,0]\\bigr)=[-1,0),\\quad f\\bigl([0,+\\infty)\\bigr)=[-1,+\\infty)",
            "Step 1 — read the range from the table of variation. Global minimum −1; limit 0 at −∞; +∞ at +∞.",
            "Étape 1 — lire l’image sur le tableau de variation. Minimum global −1 ; limite 0 en −∞ ; +∞ en +∞.",
          ),
          step(
            48,
            "m<-1:\\;\\emptyset,\\quad m=-1:\\;\\{0\\},\\quad m\\ge 0:\\;\\text{one root},\\quad -1<m<0:\\;\\text{two roots}",
            "Step 2 — number of solutions by cases. This is the sentence the marker wants, copied from the table, not guessed.",
            "Étape 2 — nombre de solutions par cas. C’est la phrase du barème, lue sur le tableau, non devinée.",
          ),
          step(
            88,
            "f(0)=-1,\\quad f(1)=(1-1)e^{1}=0,\\quad -1<-\\tfrac12<0",
            "Step 3 — substitution. f(0)=−1 and f(1)=0 pin −1/2 between the minimum and the root.",
            "Étape 3 — substitution. f(0)=−1 et f(1)=0 encadrent −1/2 entre le minimum et la racine.",
          ),
          step(
            118,
            "f(x)=-\\tfrac12\\;\\Rightarrow\\; x_1\\in(-\\infty,0),\\; x_2\\in(0,1)",
            "Step 4 — conclusion. Exactly two real solutions: one negative, one in (0,1). Do not claim a closed form unless the paper asks to solve numerically.",
            "Étape 4 — conclusion. Exactement deux solutions réelles : une négative, une dans (0,1). On n’invente pas de forme fermée si l’énoncé ne demande pas de résolution numérique.",
          ),
        ],
      },
    },
    {
      id: "common-mistake",
      start: 320,
      end: 360,
      phase: "common_mistake",
      label: L("4. Official-exam trap", "4. Piège d’épreuve"),
      avatar: { state: "speaking" },
      narration: L(
        "Two traps that lose the question. First: writing (−∞)×0=0, or writing −∞, without rewriting as −(t+1)/e^t. That is not a proof. Second: treating (x−1) as a constant and writing f'(x)=e^x. Then the critical point disappears and students mark the minimum on the asymptote. Correct derivative: f'(x)=x e^x. Correct minimum: (0,−1), which is not on y=0.",
        "Deux pièges qui font perdre la question. Premier : écrire (−∞)×0=0, ou écrire −∞, sans passer par −(t+1)/e^t. Ce n’est pas une preuve. Second : traiter (x−1) comme une constante et écrire f'(x)=e^x. Le point critique disparaît et on place le minimum sur l’asymptote. Dérivée correcte : f'(x)=x e^x. Minimum correct : (0,−1), qui n’est pas sur y=0.",
      ),
      canvas: {
        actions: [
          fadeEq(2, "(-\\infty)\\times 0\\;\\text{ is not a value}", "Wrong reasoning", "Raisonnement faux"),
          step(
            10,
            "f'(x)\\neq e^{x}",
            "Wrong: skip the product rule. Correct: f'(x)=x e^x, min at (0,−1), not on the asymptote y=0.",
            "Faux : sauter la règle du produit. Correct : f'(x)=x e^x, min en (0,−1), pas sur l’asymptote y=0.",
          ),
          step(
            24,
            "f'(x)=xe^{x},\\quad \\min(0,-1),\\quad y=0\\text{ at }-\\infty\\text{ only}",
            "Box the three facts the paper marks: derivative, minimum, asymptote. They are three different objects.",
            "On encadre les trois faits notés : dérivée, minimum, asymptote. Ce sont trois objets distincts.",
          ),
        ],
      },
    },
  ],
};
