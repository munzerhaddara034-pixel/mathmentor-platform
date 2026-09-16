import { createId } from "@/lib/ids";
import { L } from "./i18n";
import { ensurePedagogy } from "./pedagogy";
import { complexNumbersLesson } from "./sampleLessons";
import { officialExamFourPhaseLesson } from "./seedLesson";
import {
  certificateTrackSchema,
  lessonTimelineSchema,
  type CertificateTrack,
  type LessonLanguage,
  type LessonTimeline,
} from "./timeline";

function coerceTrack(track: string): CertificateTrack {
  const parsed = certificateTrackSchema.safeParse(track);
  return parsed.success ? parsed.data : "ls";
}

export type ScriptRequest = {
  topic: string;
  track: CertificateTrack | string;
  language: LessonLanguage;
  grade?: string;
};

export type ScriptResult = {
  timeline: LessonTimeline;
  source: "openai" | "template";
  warning?: string;
};

const TRACK_SCOPE: Record<string, { ar: string; en: string; fr: string }> = {
  brevet: { ar: "الشهادة المتوسطة (Brevet)", en: "Brevet (Grade 9 certificate)", fr: "Brevet (certificat de 9e)" },
  ls: { ar: "الثانوية — علوم الحياة (LS)", en: "Baccalaureate Life Sciences (LS)", fr: "Baccalauréat Sciences de la Vie (LS)" },
  se: { ar: "الثانوية — اجتماع واقتصاد (SE)", en: "Baccalaureate Sociology & Economics (SE)", fr: "Baccalauréat SES (SE)" },
  gs: { ar: "الثانوية — علوم عامة (GS)", en: "Baccalaureate General Sciences (GS)", fr: "Baccalauréat Sciences Générales (GS)" },
  lh: { ar: "الثانوية — آداب وإنسانيات (LH)", en: "Baccalaureate Literature & Humanities (LH)", fr: "Baccalauréat Lettres (LH)" },
  eb7: { ar: "الصف السابع", en: "Grade 7 (EB7)", fr: "Classe de 7e (EB7)" },
  eb8: { ar: "الصف الثامن", en: "Grade 8 (EB8)", fr: "Classe de 8e (EB8)" },
  s1: { ar: "السنة الأولى ثانوي", en: "Secondary Year 1", fr: "Première année secondaire" },
  sat: { ar: "رياضيات SAT", en: "SAT Math", fr: "SAT Math" },
};

function scopeFor(track: string) {
  return TRACK_SCOPE[track] ?? TRACK_SCOPE.ls;
}

function openaiKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.LLM_API_KEY?.trim() || "";
}

function detectPack(topic: string): "exponential" | "complex" | "quadratic" | "generic" {
  const t = topic.toLowerCase();
  if (/complex|مركب|مركّب|argand|تخييل/.test(t)) return "complex";
  if (/exp|أسي|اسي|exponential|e\^|نمو/.test(t)) return "exponential";
  if (/quad|تربيع|parabola|درجة ثانية|x\^2/.test(t)) return "quadratic";
  return "generic";
}

function cloneTimeline(base: LessonTimeline, request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  const grade = request.grade?.trim() || base.grade || "";
  return ensurePedagogy({
    ...base,
    id: createId("script"),
    topic: request.topic,
    track: coerceTrack(String(request.track)),
    grade,
    language: request.language === "fr" ? "fr" : "en",
    instructor: base.instructor ?? "Prof. Munzer Haddara",
    title: L(
      `${request.topic} — ${scope.en}${grade ? ` · ${grade}` : ""}`,
      `${request.topic} — ${scope.fr}${grade ? ` · ${grade}` : ""}`,
      `${request.topic} — ${scope.ar}${grade ? ` · ${grade}` : ""}`,
    ),
  });
}

function quadraticLesson(request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  const grade = request.grade?.trim() || "";
  return ensurePedagogy({
    id: createId("script"),
    topic: request.topic,
    track: coerceTrack(String(request.track)),
    grade,
    language: request.language === "fr" ? "fr" : "en",
    durationSec: 350,
    instructor: "Prof. Munzer Haddara",
    title: L(
      `${request.topic} — ${scope.en} official pattern`,
      `${request.topic} — modèle d’épreuve ${scope.fr}`,
      `${request.topic} — ${scope.ar}`,
    ),
    media: { poster: "/teachers/munzer.jpg" },
    segments: [
      {
        id: "intro",
        start: 0,
        end: 50,
        phase: "introduction",
        label: L("1. Exam framing & domain", "1. Cadre d’épreuve et ensemble de définition"),
        avatar: { state: "speaking" },
        narration: L(
          `${request.topic} on the ${scope.en} paper is a complete quadratic study, not a slogan. Domain first: a polynomial is defined on R. We will need the discriminant, the axis of symmetry, the table of variation, and a sketch. Model: f(x)=x²−4x+3. Grade: ${grade || "Terminale / Brevet as listed"}.`,
          `${request.topic} dans l’épreuve ${scope.fr} est une étude complète de trinôme, pas un slogan. D’abord D_f = R. Il faudra le discriminant, l’axe de symétrie, le tableau de variation et une allure. Modèle : f(x)=x²−4x+3. Classe : ${grade || "Terminale / Brevet selon l’énoncé"}.`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "fade_equation",
              latex: "f(x)=x^{2}-4x+3=(x-1)(x-3)",
              payload: { caption: L("Given on the paper", "Donnée de l’énoncé") },
            },
            {
              at: 16,
              type: "show_step",
              payload: {
                latex: "D_f=\\mathbb{R}",
                math_latex: "D_f=\\mathbb{R}",
                step_en: "A polynomial has domain R. Do not write x≠0 unless a denominator appears.",
                step_fr: "Un polynôme a pour ensemble de définition R. On n’écrit x≠0 que s’il y a un dénominateur.",
                text: L(
                  "A polynomial has domain R. Do not write x≠0 unless a denominator appears.",
                  "Un polynôme a pour ensemble de définition R. On n’écrit x≠0 que s’il y a un dénominateur.",
                ),
              },
            },
          ],
        },
      },
      {
        id: "rule-graph",
        start: 50,
        end: 150,
        phase: "rule_graph",
        label: L("2. Proof sketch & graph", "2. Esquisse de preuve et graphe"),
        avatar: { state: "paused" },
        narration: L(
          "Look at the board. Discriminant Δ=b²−4ac=16−12=4>0, so two real roots x=1 and x=3. Axis of symmetry: x=−b/(2a)=4/2=2. f(2)=4−8+3=−1, a global minimum because a=1>0. Sketch: roots on the axis, vertex (2,−1).",
          "Regardez le tableau. Discriminant Δ=b²−4ac=16−12=4>0, donc deux racines réelles x=1 et x=3. Axe de symétrie : x=−b/(2a)=4/2=2. f(2)=4−8+3=−1, minimum global car a=1>0. Allure : racines sur l’axe, sommet (2,−1).",
        ),
        canvas: {
          actions: [
            {
              at: 4,
              type: "show_step",
              payload: {
                latex: "\\Delta=16-12=4,\\quad x=\\dfrac{4\\pm 2}{2}\\in\\{1,3\\}",
                math_latex: "\\Delta=16-12=4,\\quad x=\\dfrac{4\\pm 2}{2}\\in\\{1,3\\}",
                step_en: "Proof sketch: compute Δ, then the quadratic formula. Factor as (x−1)(x−3).",
                step_fr: "Esquisse : calculer Δ, puis la formule. On factorise (x−1)(x−3).",
                text: L(
                  "Proof sketch: compute Δ, then the quadratic formula. Factor as (x−1)(x−3).",
                  "Esquisse : calculer Δ, puis la formule. On factorise (x−1)(x−3).",
                ),
              },
            },
            {
              at: 22,
              type: "render_graph",
              expression: "(x-1)*(x-3)",
              domain: [-1, 5],
              highlights: {
                roots: [
                  [1, 0],
                  [3, 0],
                ],
                extrema: [[2, -1]],
              },
              payload: {
                kind: "function",
                fn: "(x-1)*(x-3)",
                xDomain: [-1, 5],
                yDomain: [-5, 8],
                title: L("y = (x−1)(x−3)", "y = (x−1)(x−3)"),
              },
            },
            {
              at: 40,
              type: "highlight_point",
              payload: {
                kind: "extrema",
                x: 2,
                y: -1,
                label: L("Vertex (2, −1)", "Sommet (2, −1)"),
              },
            },
          ],
        },
      },
      {
        id: "real-example",
        start: 150,
        end: 310,
        phase: "real_example",
        label: L("3. Official exercise", "3. Exercice d’épreuve"),
        avatar: { state: "speaking" },
        narration: L(
          "Exam exercise: solve f(x)≤0. Step 1 — roots 1 and 3 from the factorisation already proved. Step 2 — a>0 so the parabola is below the axis between the roots. Step 3 — substitute a test point, x=2: f(2)=−1≤0. Step 4 — box the closed interval [1,3]. Endpoints are included because the inequality is not strict.",
          "Exercice d’épreuve : résoudre f(x)≤0. Étape 1 — racines 1 et 3 déjà prouvées. Étape 2 — a>0 donc la parabole est sous l’axe entre les racines. Étape 3 — point test x=2 : f(2)=−1≤0. Étape 4 — encadrer l’intervalle fermé [1,3]. Les bornes sont incluses car l’inégalité n’est pas stricte.",
        ),
        canvas: {
          actions: [
            {
              at: 4,
              type: "fade_equation",
              latex: "x^{2}-4x+3\\le 0",
              payload: { caption: L("Solve on R", "Résoudre sur R") },
            },
            {
              at: 16,
              type: "show_step",
              payload: {
                latex: "(x-1)(x-3)=0\\Rightarrow x=1\\text{ or }x=3",
                math_latex: "(x-1)(x-3)=0\\Rightarrow x=1\\text{ or }x=3",
                step_en: "Step 1 — factoring already justified by Δ=4. Roots 1 and 3.",
                step_fr: "Étape 1 — factorisation déjà justifiée par Δ=4. Racines 1 et 3.",
                text: L(
                  "Step 1 — factoring already justified by Δ=4. Roots 1 and 3.",
                  "Étape 1 — factorisation déjà justifiée par Δ=4. Racines 1 et 3.",
                ),
              },
            },
            {
              at: 48,
              type: "show_step",
              payload: {
                latex: "a=1>0\\Rightarrow f\\le 0\\text{ on }[1,3]",
                math_latex: "a=1>0\\Rightarrow f\\le 0\\text{ on }[1,3]",
                step_en: "Step 2 — sign of a. The parabola opens up, so f is negative between the roots.",
                step_fr: "Étape 2 — signe de a. La parabole tourne vers le haut, donc f est négative entre les racines.",
                text: L(
                  "Step 2 — sign of a. The parabola opens up, so f is negative between the roots.",
                  "Étape 2 — signe de a. La parabole tourne vers le haut, donc f est négative entre les racines.",
                ),
              },
            },
            {
              at: 88,
              type: "show_step",
              payload: {
                latex: "f(2)=4-8+3=-1\\le 0",
                math_latex: "f(2)=4-8+3=-1\\le 0",
                step_en: "Step 3 — substitution check at the vertex. Never skip this line on an official paper.",
                step_fr: "Étape 3 — substitution au sommet. On ne saute jamais cette ligne en épreuve officielle.",
                text: L(
                  "Step 3 — substitution check at the vertex. Never skip this line on an official paper.",
                  "Étape 3 — substitution au sommet. On ne saute jamais cette ligne en épreuve officielle.",
                ),
              },
            },
            {
              at: 120,
              type: "show_step",
              payload: {
                latex: "S=[1,3]",
                math_latex: "S=[1,3]",
                step_en: "Step 4 — box S=[1,3]. Closed because ≤ includes the roots.",
                step_fr: "Étape 4 — encadrer S=[1,3]. Fermé car ≤ inclut les racines.",
                text: L(
                  "Step 4 — box S=[1,3]. Closed because ≤ includes the roots.",
                  "Étape 4 — encadrer S=[1,3]. Fermé car ≤ inclut les racines.",
                ),
              },
            },
          ],
        },
      },
      {
        id: "common-mistake",
        start: 310,
        end: 350,
        phase: "common_mistake",
        label: L("4. Official-exam trap", "4. Piège d’épreuve"),
        avatar: { state: "speaking" },
        narration: L(
          "Trap: writing the vertex as x=b/(2a) and dropping the minus. Here b=−4, so −b/(2a)=4/2=2, not −2. Students who write −2 then sketch the minimum in the wrong half-plane and lose the inequality. Correct: x_v=−b/(2a)=2, f(2)=−1.",
          "Piège : écrire le sommet x=b/(2a) en oubliant le moins. Ici b=−4, donc −b/(2a)=4/2=2, pas −2. Qui écrit −2 dessine le minimum du mauvais côté et perd l’inéquation. Correct : x_v=−b/(2a)=2, f(2)=−1.",
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "fade_equation",
              latex: "x_{v}=-\\dfrac{b}{2a}\\neq\\dfrac{b}{2a}",
              payload: { caption: L("Wrong reasoning", "Raisonnement faux") },
            },
            {
              at: 14,
              type: "show_step",
              payload: {
                latex: "b=-4,\\; a=1\\Rightarrow x_v=2,\\; f(2)=-1",
                math_latex: "b=-4,\\; a=1\\Rightarrow x_v=2,\\; f(2)=-1",
                step_en: "Correction: keep the minus, substitute b=−4, then check f(2) by substitution.",
                step_fr: "Correction : garder le moins, substituer b=−4, puis vérifier f(2) par substitution.",
                text: L(
                  "Correction: keep the minus, substitute b=−4, then check f(2) by substitution.",
                  "Correction : garder le moins, substituer b=−4, puis vérifier f(2) par substitution.",
                ),
              },
            },
          ],
        },
      },
    ],
  });
}

function genericLesson(request: ScriptRequest): LessonTimeline {
  const scope = scopeFor(String(request.track));
  const topic = request.topic.trim();
  const safe = topic.replace(/[\\{}]/g, "");
  const grade = request.grade?.trim() || "";
  return ensurePedagogy({
    id: createId("script"),
    topic,
    track: coerceTrack(String(request.track)),
    grade,
    language: request.language === "fr" ? "fr" : "en",
    durationSec: 350,
    instructor: "Prof. Munzer Haddara",
    title: L(`${topic} — ${scope.en} official pattern`, `${topic} — modèle d’épreuve ${scope.fr}`, `${topic} — ${scope.ar}`),
    media: { poster: "/teachers/munzer.jpg" },
    segments: [
      {
        id: "intro",
        start: 0,
        end: 50,
        phase: "introduction",
        label: L("1. Exam framing & domain", "1. Cadre d’épreuve et ensemble de définition"),
        avatar: { state: "speaking" },
        narration: L(
          `${topic} on the ${scope.en} paper (${grade || "as listed"}) is marked as a complete study: write the definition, the domain, a proof sketch of the rule, a graph when the question asks for an allure, then a graded exercise. We do not sell a slogan. Model quantity: Q(x)=5e^x on R.`,
          `${topic} dans l’épreuve ${scope.fr} (${grade || "selon l’énoncé"}) se note comme une étude complète : définition, ensemble de définition, esquisse de preuve de la règle, graphe si l’allure est demandée, puis un exercice noté. On ne vend pas un slogan. Quantité modèle : Q(x)=5e^x sur R.`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "fade_equation",
              latex: `\\text{${safe}}`,
              payload: { caption: L("Topic on this paper", "Thème de l’épreuve") },
            },
            {
              at: 16,
              type: "show_step",
              payload: {
                latex: "Q(x)=5e^{x},\\quad D_Q=\\mathbb{R}",
                math_latex: "Q(x)=5e^{x},\\quad D_Q=\\mathbb{R}",
                step_en: "e^x is defined on R, so a constant multiple is defined on R. State the domain before any formula.",
                step_fr: "e^x est définie sur R, donc un multiple constant l’est aussi. On écrit D_Q avant toute formule.",
                text: L(
                  "e^x is defined on R, so a constant multiple is defined on R. State the domain before any formula.",
                  "e^x est définie sur R, donc un multiple constant l’est aussi. On écrit D_Q avant toute formule.",
                ),
              },
            },
          ],
        },
      },
      {
        id: "rule-graph",
        start: 50,
        end: 150,
        phase: "rule_graph",
        label: L("2. Proof sketch & graph", "2. Esquisse de preuve et graphe"),
        avatar: { state: "paused" },
        narration: L(
          `Look at the board. Proof sketch: the derivative of e^x is e^x, so Q'(x)=5e^x>0 on R. Q is strictly increasing. Q(0)=5, limit 0 at minus infinity (horizontal asymptote y=0), plus infinity at plus infinity. This graph is required because the ${scope.en} question will ask for the allure and the asymptote.`,
          `Regardez le tableau. Esquisse : la dérivée de e^x est e^x, donc Q'(x)=5e^x>0 sur R. Q est strictement croissante. Q(0)=5, limite 0 en −∞ (asymptote y=0), +∞ en +∞. Le graphe est obligatoire car la question ${scope.fr} demandera l’allure et l’asymptote.`,
        ),
        canvas: {
          actions: [
            {
              at: 4,
              type: "show_step",
              payload: {
                latex: "Q'(x)=5e^{x}>0",
                math_latex: "Q'(x)=5e^{x}>0",
                step_en: "Proof sketch: chain the constant 5 with (e^x)'=e^x. Strictly increasing on R.",
                step_fr: "Esquisse : le 5 constant et (e^x)'=e^x. Strictement croissante sur R.",
                text: L(
                  "Proof sketch: chain the constant 5 with (e^x)'=e^x. Strictly increasing on R.",
                  "Esquisse : le 5 constant et (e^x)'=e^x. Strictement croissante sur R.",
                ),
              },
            },
            {
              at: 18,
              type: "render_graph",
              expression: "5*exp(x)",
              domain: [-2, 2],
              highlights: { extrema: [], roots: [], asymptotes: [{ y: 0 }] },
              payload: {
                kind: "function",
                fn: "5*exp(x)",
                xDomain: [-2, 2],
                yDomain: [-1, 12],
                title: L(`Model for ${topic}`, `Modèle pour ${topic}`),
              },
            },
            {
              at: 36,
              type: "highlight_point",
              payload: {
                kind: "asymptote",
                axis: "y",
                value: 0,
                label: L("Horizontal asymptote y = 0", "Asymptote horizontale y = 0"),
              },
            },
          ],
        },
      },
      {
        id: "real-example",
        start: 150,
        end: 310,
        phase: "real_example",
        label: L("3. Official exercise", "3. Exercice d’épreuve"),
        avatar: { state: "speaking" },
        narration: L(
          `Worked exercise on ${topic}: a quantity follows Q(x)=5e^x. Evaluate Q(0) and Q(1), then the ratio Q(1)/Q(0), then solve Q(x)=5e. Every line is substitution or algebra — nothing is quoted from memory without a check.`,
          `Exercice résolu sur ${topic} : une quantité suit Q(x)=5e^x. Calculer Q(0) et Q(1), puis le rapport Q(1)/Q(0), puis résoudre Q(x)=5e. Chaque ligne est une substitution ou de l’algèbre — on ne cite rien de mémoire sans vérification.`,
        ),
        canvas: {
          actions: [
            {
              at: 4,
              type: "fade_equation",
              latex: "Q(x)=5e^{x}",
              payload: { caption: L("Given", "Donnée") },
            },
            {
              at: 16,
              type: "show_step",
              payload: {
                latex: "Q(0)=5e^{0}=5",
                math_latex: "Q(0)=5e^{0}=5",
                step_en: "Step 1 — substitute x=0. e^0=1 is a theorem, not a slogan: write it.",
                step_fr: "Étape 1 — substituer x=0. e^0=1 est un théorème : on l’écrit.",
                text: L(
                  "Step 1 — substitute x=0. e^0=1 is a theorem, not a slogan: write it.",
                  "Étape 1 — substituer x=0. e^0=1 est un théorème : on l’écrit.",
                ),
              },
            },
            {
              at: 48,
              type: "show_step",
              payload: {
                latex: "Q(1)=5e^{1}=5e",
                math_latex: "Q(1)=5e^{1}=5e",
                step_en: "Step 2 — substitute x=1. Do not replace e by 2.7 unless the paper asks for a decimal.",
                step_fr: "Étape 2 — substituer x=1. On ne remplace pas e par 2,7 sauf si l’énoncé demande une décimale.",
                text: L(
                  "Step 2 — substitute x=1. Do not replace e by 2.7 unless the paper asks for a decimal.",
                  "Étape 2 — substituer x=1. On ne remplace pas e par 2,7 sauf si l’énoncé demande une décimale.",
                ),
              },
            },
            {
              at: 88,
              type: "show_step",
              payload: {
                latex: "\\dfrac{Q(1)}{Q(0)}=e",
                math_latex: "\\dfrac{Q(1)}{Q(0)}=e",
                step_en: "Step 3 — the ratio checks the functional equation Q(x+1)=e Q(x).",
                step_fr: "Étape 3 — le rapport vérifie l’équation fonctionnelle Q(x+1)=e Q(x).",
                text: L(
                  "Step 3 — the ratio checks the functional equation Q(x+1)=e Q(x).",
                  "Étape 3 — le rapport vérifie l’équation fonctionnelle Q(x+1)=e Q(x).",
                ),
              },
            },
            {
              at: 120,
              type: "show_step",
              payload: {
                latex: "Q(x)=5e\\Rightarrow 5e^{x}=5e\\Rightarrow x=1",
                math_latex: "Q(x)=5e\\Rightarrow 5e^{x}=5e\\Rightarrow x=1",
                step_en: "Step 4 — solve by algebra (injectivity of exp), then box x=1. Substitution check: Q(1)=5e.",
                step_fr: "Étape 4 — résoudre par injectivité de exp, puis encadrer x=1. Vérification : Q(1)=5e.",
                text: L(
                  "Step 4 — solve by algebra (injectivity of exp), then box x=1. Substitution check: Q(1)=5e.",
                  "Étape 4 — résoudre par injectivité de exp, puis encadrer x=1. Vérification : Q(1)=5e.",
                ),
              },
            },
          ],
        },
      },
      {
        id: "common-mistake",
        start: 310,
        end: 350,
        phase: "common_mistake",
        label: L("4. Official-exam trap", "4. Piège d’épreuve"),
        avatar: { state: "speaking" },
        narration: L(
          `The ${scope.en} trap on ${topic}: quoting the formula before the hypothesis. Example: writing (e^x)'=e^x without stating that the function is the exponential, or applying a neighbour's rule (ln, power) on the same line. Write the hypothesis, then the rule, then one substitution check.`,
          `Le piège ${scope.fr} sur ${topic} : citer la formule avant l’hypothèse. Exemple : écrire (e^x)'=e^x sans nommer la fonction, ou coller la règle voisine (ln, puissance) sur la même ligne. On écrit l’hypothèse, puis la règle, puis une substitution de contrôle.`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "fade_equation",
              latex: "\\text{hypothesis first, then the rule}",
              payload: { caption: L("Wrong: slogan without domain", "Faux : slogan sans domaine") },
            },
            {
              at: 14,
              type: "show_step",
              payload: {
                latex: "Q'(x)=5e^{x}\\quad(\\text{not }5x e^{x-1})",
                math_latex: "Q'(x)=5e^{x}\\quad(\\text{not }5x e^{x-1})",
                step_en: "Correction: this is not a power of x. Do not apply nx^{n−1} to e^x.",
                step_fr: "Correction : ce n’est pas une puissance de x. On n’applique pas nx^{n−1} à e^x.",
                text: L(
                  "Correction: this is not a power of x. Do not apply nx^{n−1} to e^x.",
                  "Correction : ce n’est pas une puissance de x. On n’applique pas nx^{n−1} à e^x.",
                ),
              },
            },
          ],
        },
      },
    ],
  });
}

export function buildTemplateScript(request: ScriptRequest): LessonTimeline {
  const pack = detectPack(request.topic);
  if (pack === "complex") return cloneTimeline(complexNumbersLesson, request);
  if (pack === "exponential") return cloneTimeline(officialExamFourPhaseLesson, request);
  if (pack === "quadratic") return quadraticLesson(request);
  return genericLesson(request);
}

const SYSTEM_PROMPT = `You are Professor Munzer Haddara's lesson-script writer for MathMentor, a Lebanese Secondary & Brevet mathematics platform (English section / Terminale LS, GS, SE).

Return ONE JSON object only, matching this schema:
{
  "id": string,
  "title": { "en": string, "fr": string },
  "language": "en" | "fr",
  "instructor": "Prof. Munzer Haddara",
  "defaultLanguage": "en",
  "durationSec": number,
  "track": string,
  "grade": string,
  "topic": string,
  "segments": [
    {
      "id": string,
      "start": number,
      "end": number,
      "phase": "introduction" | "rule_graph" | "real_example" | "common_mistake",
      "narration": { "en": string, "fr": string },
      "avatar": { "state": "speaking" | "paused" },
      "canvas": {
        "actions": [
          {
            "at": number,
            "type": "show_equation" | "fade_equation" | "render_graph" | "highlight_point" | "show_step" | "clear",
            "payload": {
              "latex": string,
              "math_latex": string,
              "step_en": string,
              "step_fr": string,
              "fn": string,
              "expression": string,
              "domain": [number, number]
            }
          }
        ]
      }
    }
  ]
}

Hard rules:
1. ALWAYS include exactly these four phases in order. Durations about 50s, 100s, 160s, 40s (total ~350s). instructor is always "Prof. Munzer Haddara".
2. introduction: Lebanese certificate scope (Brevet / LS / GS / SE / LH) + domain with justification (not a slogan). Canvas: fade_equation / show_equation.
3. rule_graph: a proof sketch of the rule (named hypotheses, algebra lines). MUST include type "render_graph" (fn is a JS expression in x). avatar.state = "paused". Highlight roots, extrema, asymptotes when they exist.
4. real_example: one full official-exam exercise. MUST include at least THREE show_step actions with math_latex, step_en, AND step_fr of equal quality (not machine-gibberish). Include substitution or factoring and a boxed conclusion.
5. common_mistake: name the WRONG reasoning, then the correction. ~40s.
6. "at" is seconds from the start of THAT segment.
7. Every narration, title, caption, and step MUST have English AND French (Lebanese English-section with a French toggle). French must read like a French-section paper (ensemble de définition, tableau de variation, barème), not a literal calque.
8. Default language is English. Ready to charge: a paying student should be able to copy the board into an official booklet.`;

async function generateWithOpenAI(request: ScriptRequest): Promise<LessonTimeline> {
  const key = openaiKey();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const scope = scopeFor(String(request.track));
  const user = JSON.stringify({
    topic: request.topic,
    track: request.track,
    trackLabel: scope,
    language: request.language,
    grade: request.grade ?? "",
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 400)}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty script.");

  const parsedJson: unknown = JSON.parse(content);
  const parsed = lessonTimelineSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`OpenAI JSON failed schema: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return ensurePedagogy(parsed.data);
}

export async function generateLessonScript(request: ScriptRequest): Promise<ScriptResult> {
  const topic = request.topic.trim();
  if (!topic) {
    throw new Error("topic is required");
  }

  if (openaiKey()) {
    try {
      const timeline = await generateWithOpenAI({ ...request, topic });
      return { timeline, source: "openai" };
    } catch (error) {
      const timeline = buildTemplateScript({ ...request, topic });
      return {
        timeline,
        source: "template",
        warning: error instanceof Error ? error.message : "OpenAI failed; used template script.",
      };
    }
  }

  return {
    timeline: buildTemplateScript({ ...request, topic }),
    source: "template",
    warning: "No OPENAI_API_KEY (or LLM_API_KEY). Returned a deterministic four-phase template with real math.",
  };
}
