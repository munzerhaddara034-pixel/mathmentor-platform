import { createId } from "@/lib/ids";
import { L } from "@/lib/studio/i18n";
import { ensurePedagogy } from "@/lib/studio/pedagogy";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "@/lib/studio/heygenClient";
import type { CertificateTrack, LessonLanguage, LessonTimeline } from "@/lib/studio/timeline";
import {
  DEFAULT_VARIATION_TABLE,
  INSTRUCTOR_AR,
  INSTRUCTOR_EN,
  defaultExamTipFor,
  sequenceLine,
  sequenceLineFr,
} from "@/lib/pedagogy/lebanese";
import { formatLebaneseEquation, formatLatexFields } from "@/lib/math/lebaneseEquationFormat";
import type {
  AsymptoteSpec,
  AvatarScript,
  CanvasTimelineJson,
  ExamTip,
  MathSolution,
  SolverSource,
  SolverStep,
  StudyKind,
} from "./types";

export type GraphSpec = {
  fn: string;
  domain?: [number, number];
  yDomain?: [number, number];
  highlights?: {
    roots?: Array<[number, number]>;
    extrema?: Array<[number, number]>;
    asymptotes?: Array<{ x?: number; y?: number }>;
  };
};

export type TrapSpec = {
  wrong: string;
  wrongFr: string;
  correction: string;
  correctionFr: string;
  latex: string;
};

export type AssembleInput = {
  question: string;
  summary: string;
  finalAnswer: string;
  finalAnswerLatex: string;
  steps: SolverStep[];
  graph?: GraphSpec;
  trap?: TrapSpec;
  topic: string;
  track?: CertificateTrack;
  language?: LessonLanguage;
  source: SolverSource;
  warning?: string;
  recognizedFromImage?: string;
  given?: import("./types").SolverGiven;
  topicTag?: string;
  examTip?: ExamTip;
  studyKind?: StudyKind;
  asymptotes?: AsymptoteSpec[];
  needsRetake?: boolean;
  retakeMessageEn?: string;
  retakeMessageAr?: string;
};

function topicTagFrom(topic: string) {
  const t = topic.toLowerCase();
  if (/quad|تربيع/.test(t)) return "quadratic";
  if (/limit|نهاي/.test(t)) return "limits";
  if (/exp|أسي/.test(t)) return "exponential";
  if (/system|جملة/.test(t)) return "systems";
  if (/triangle|فيثاغ|geom/.test(t)) return "geometry";
  if (/linear|خطي/.test(t)) return "linear";
  if (/complex|مركب/.test(t)) return "complex";
  if (/integral|تكامل/.test(t)) return "integrals";
  if (/percent|نسبة/.test(t)) return "percentages";
  if (/unclear/.test(t)) return "unclear";
  return "general";
}

function studyKindFrom(topic: string, tag?: string): StudyKind {
  const t = `${topic} ${tag ?? ""}`.toLowerCase();
  if (/exp|function|étude|derive|variation/.test(t)) return "real_function";
  if (/geom|triangle|vector|فيثاغ/.test(t)) return "geometry";
  if (/complex|مركب/.test(t)) return "complex";
  if (/probab|احتمال/.test(t)) return "probability";
  if (/limit|نهاي/.test(t)) return "limits";
  if (/quad|linear|system|algebra/.test(t)) return "algebra";
  return "general";
}

function withTheorems(steps: SolverStep[]): SolverStep[] {
  return steps.map((step) => ({
    ...step,
    theoremEn: step.theoremEn || step.title,
    theoremFr: step.theoremFr || step.titleFr,
    theoremAr: step.theoremAr || step.titleAr || "قانون معلّل",
  }));
}

function stepSeconds(count: number) {
  return Math.max(12, Math.min(22, 48 / Math.max(1, count)));
}

export function assembleSolution(input: AssembleInput): MathSolution {
  const language: LessonLanguage = input.language === "fr" ? "fr" : input.language === "ar" ? "ar" : "en";
  const track: CertificateTrack = input.track ?? "ls";
  const steps = withTheorems(input.steps.length ? input.steps : fallbackSteps(input.question, input.finalAnswerLatex)).map(
    (step) => ({ ...step, latex: formatLebaneseEquation(step.latex) }),
  );
  const trap = input.trap ?? defaultTrap(input.finalAnswerLatex);
  if (trap.latex) trap.latex = formatLebaneseEquation(trap.latex);
  const graph = input.graph ?? { fn: "x*x - 5*x + 6", domain: [-1, 6] as [number, number], highlights: { roots: [[2, 0], [3, 0]] } };
  const examTip: ExamTip = {
    en: input.examTip?.en || defaultExamTipFor(input.topic).en,
    fr: input.examTip?.fr || defaultExamTipFor(input.topic).fr,
    ar: input.examTip?.ar || defaultExamTipFor(input.topic).ar,
  };
  const studyKind = input.studyKind || studyKindFrom(input.topic, input.topicTag);
  const asymptotes = input.asymptotes ?? asymptotesFromGraph(graph);
  const finalAnswerLatex = formatLebaneseEquation(input.finalAnswerLatex || input.finalAnswer || "");
  const given = input.given
    ? { ...input.given, latex: formatLebaneseEquation(input.given.latex) }
    : undefined;

  const introDur = 32;
  const ruleDur = 72;
  const perStep = stepSeconds(steps.length);
  const exampleDur = Math.max(50, Math.round(perStep * Math.max(3, steps.length) + 8));
  const trapDur = 28;
  const durationSec = introDur + ruleDur + exampleDur + trapDur;

  const avatarScript = buildAvatarScript(input.question, steps, input.finalAnswer, trap, examTip, language);
  const timeline = formatLatexFields(
    ensurePedagogy(
      buildTimeline({
        question: input.question,
        summary: input.summary,
        finalAnswer: input.finalAnswer,
        finalAnswerLatex,
        steps,
        graph,
        trap,
        examTip,
        studyKind,
        asymptotes,
        topic: input.topic,
        track,
        language,
        introDur,
        ruleDur,
        exampleDur,
        trapDur,
        durationSec,
      }),
    ),
  );

  const events: CanvasTimelineJson["events"] = [];
  for (const segment of timeline.segments) {
    for (const action of segment.canvas.actions) {
      events.push({
        at: segment.start + action.at,
        type: action.type,
        latex: typeof action.latex === "string" ? action.latex : typeof action.payload?.latex === "string" ? String(action.payload.latex) : undefined,
        expression:
          typeof action.payload?.fn === "string"
            ? String(action.payload.fn)
            : typeof action.expression === "string"
              ? action.expression
              : undefined,
        domain: Array.isArray(action.payload?.domain)
          ? (action.payload.domain as [number, number])
          : Array.isArray(action.domain)
            ? (action.domain as [number, number])
            : undefined,
        highlights: action.payload?.highlights ?? action.highlights,
        caption: action.payload?.caption as CanvasTimelineJson["events"][number]["caption"],
        math_latex: typeof action.payload?.math_latex === "string" ? String(action.payload.math_latex) : undefined,
        step_en: typeof action.payload?.step_en === "string" ? String(action.payload.step_en) : undefined,
        step_fr: typeof action.payload?.step_fr === "string" ? String(action.payload.step_fr) : undefined,
      });
    }
  }

  return formatLatexFields({
    summary: input.summary,
    finalAnswer: input.finalAnswer,
    finalAnswerLatex,
    examTip,
    studyKind,
    asymptotes,
    given: given ?? {
      latex: formatLebaneseEquation(finalAnswerLatex || input.question.slice(0, 120)),
      aimEn: input.summary,
      aimFr: input.summary,
      aimAr: `المطلوب: ${input.finalAnswer}`,
    },
    steps,
    avatarScript,
    canvasTimeline: {
      durationSec: timeline.durationSec,
      events,
      chapters: timeline.chapters,
    },
    timeline,
    topic: input.topic,
    topicTag: input.topicTag || topicTagFrom(input.topic),
    track,
    language,
    source: input.source,
    warning: input.warning,
    recognizedFromImage: input.recognizedFromImage,
    needsRetake: Boolean(input.needsRetake),
    retakeMessageEn: input.retakeMessageEn,
    retakeMessageAr: input.retakeMessageAr,
  });
}

function fallbackSteps(question: string, latex: string): SolverStep[] {
  return [
    {
      title: "Read the given",
      titleFr: "Lire les données",
      titleAr: "قراءة المعطيات",
      latex: latex || question,
      theoremEn: "Copy the given before any formula",
      theoremAr: "كتابة المعطيات قبل أي قانون",
      explanationEn: "Copy the given information before any calculation, as on a Lebanese official paper.",
      explanationFr: "On recopie les données avant tout calcul, comme sur une copie officielle libanaise.",
      explanationAr: "نكتب المعطيات قبل أي حساب كما في ورقة رسمية لبنانية.",
    },
    {
      title: "Choose the rule",
      titleFr: "Choisir la règle",
      titleAr: "اختيار القانون",
      latex: "\\text{rule first, then algebra}",
      explanationEn: "Name the theorem (product rule, discriminant, Pythagoras…) with its hypothesis.",
      explanationFr: "On nomme le théorème (produit, discriminant, Pythagore…) avec son hypothèse.",
      explanationAr: "نسمّي القانون مع فرضيته قبل التعويض.",
    },
    {
      title: "Conclude",
      titleFr: "Conclure",
      titleAr: "الخلاصة",
      latex: latex || "\\text{boxed answer}",
      explanationEn: "Box the final answer and substitute back when the paper allows a check.",
      explanationFr: "On encadre la réponse et on substitue pour vérifier quand c’est possible.",
      explanationAr: "نضع الناتج في إطار ونتحقق بالتعويض إن أمكن.",
    },
  ];
}

function defaultTrap(latex: string): TrapSpec {
  return {
    wrong: "Jumping to the boxed number without writing the hypothesis of the rule.",
    wrongFr: "Sauter au nombre encadré sans écrire l’hypothèse de la règle.",
    correction: "Write given → D_f → rule → algebra → boxed check. That is the MathMentor / Prof. Munzer Haddara barème.",
    correctionFr: "Données → D_f → règle → algèbre → cadre. C’est le barème de MathMentor / Prof. Munzer Haddara.",
    latex: latex || "\\text{hypothesis first}",
  };
}

function asymptotesFromGraph(graph: GraphSpec): AsymptoteSpec[] {
  const rows = graph.highlights?.asymptotes ?? [];
  const out: AsymptoteSpec[] = [];
  for (const row of rows) {
    if (typeof row.x === "number") out.push({ kind: "vertical", equation: `x=${row.x}` });
    if (typeof row.y === "number") out.push({ kind: "horizontal", equation: `y=${row.y}` });
  }
  return out;
}

function buildAvatarScript(
  question: string,
  steps: SolverStep[],
  finalAnswer: string,
  trap: TrapSpec,
  examTip: ExamTip,
  language: LessonLanguage,
): AvatarScript {
  const en = [
    `I am ${INSTRUCTOR_EN}. Let us solve this together, line by line, as on a Lebanese official paper.`,
    `Key Idea / Exam Tip — how we think about the question, before any calculation: ${examTip.en}`,
    `The official sequence is ${sequenceLine()}.`,
    `The question: ${question}.`,
    ...steps.map((step, index) => {
      const verb = step.examVerbEn ? `${step.examVerbEn}. ` : "";
      return `Step ${index + 1}. ${verb}${step.explanationEn}`;
    }),
    `Boxed Final Answer: ${finalAnswer}.`,
    `Common pitfalls that lose barème marks: ${trap.wrong} Correction: ${trap.correction}`,
  ].join(" ");

  const fr = [
    `Je suis ${INSTRUCTOR_EN}. Nous résolvons ensemble, ligne par ligne, comme sur une copie officielle libanaise.`,
    `Idée clé / Conseil d’épreuve — comment on pense la question, avant tout calcul : ${examTip.fr}`,
    `La suite officielle est ${sequenceLineFr()}.`,
    `L’énoncé : ${question}.`,
    ...steps.map((step, index) => {
      const verb = step.examVerbFr ? `${step.examVerbFr}. ` : "";
      return `Étape ${index + 1}. ${verb}${step.explanationFr}`;
    }),
    `Réponse finale encadrée : ${finalAnswer}.`,
    `Pièges fréquents (barème) : ${trap.wrongFr} Correction : ${trap.correctionFr}`,
  ].join(" ");

  const ar = [
    `أنا ${INSTRUCTOR_AR}. نحلّ المسألة سطراً بسطر كما في ورقة رسمية لبنانية.`,
    `الفكرة الأساسية قبل أي حساب: ${examTip.ar || examTip.en}`,
    `السؤال: ${question}.`,
    ...steps.map((step, index) => `الخطوة ${index + 1}. ${step.explanationAr || step.explanationEn}`),
    `الجواب النهائي في إطار: ${finalAnswer}.`,
    `أخطاء شائعة تخسر علامات الباريم: لا تقفز إلى الناتج قبل مجموعة التعريف والقانون والتحقق.`,
  ].join(" ");

  void language;
  return { en, fr, ar };
}

function buildTimeline(input: {
  question: string;
  summary: string;
  finalAnswer: string;
  finalAnswerLatex: string;
  steps: SolverStep[];
  graph: GraphSpec;
  trap: TrapSpec;
  examTip: ExamTip;
  studyKind: StudyKind;
  asymptotes: AsymptoteSpec[];
  topic: string;
  track: CertificateTrack;
  language: LessonLanguage;
  introDur: number;
  ruleDur: number;
  exampleDur: number;
  trapDur: number;
  durationSec: number;
}): LessonTimeline {
  const perStep = Math.max(10, Math.floor((input.exampleDur - 8) / Math.max(3, input.steps.length)));
  const domain = input.graph.domain ?? [-4, 4];
  const introEnd = input.introDur;
  const ruleEnd = introEnd + input.ruleDur;
  const exampleEnd = ruleEnd + input.exampleDur;
  const trapEnd = exampleEnd + input.trapDur;
  const asymptoteLatex =
    input.asymptotes.map((item) => item.equation).join(",\\ ") || "y=b\\text{ or }x=a\\text{ or }y=ax+b";

  const exampleActions = input.steps.map((step, index) => {
    const last = index === input.steps.length - 1 || step.boxed;
    return {
      at: 4 + index * perStep,
      type: last ? ("boxAnswer" as const) : ("show_step" as const),
      latex: step.latex,
      payload: {
        latex: last ? `\\boxed{${step.latex}}` : step.latex,
        math_latex: last ? `\\boxed{${step.latex}}` : step.latex,
        step_en: `${step.examVerbEn ? `${step.examVerbEn} — ` : ""}${step.explanationEn}`,
        step_fr: `${step.examVerbFr ? `${step.examVerbFr} — ` : ""}${step.explanationFr}`,
        text: L(step.explanationEn, step.explanationFr, step.explanationAr),
        index: index + 1,
        boxed: last,
        marks: last ? "barème" : undefined,
      },
    };
  });

  while (exampleActions.length < 3) {
    exampleActions.push({
      at: 4 + exampleActions.length * perStep,
      type: "boxAnswer",
      latex: input.finalAnswerLatex,
      payload: {
        latex: `\\boxed{${input.finalAnswerLatex}}`,
        math_latex: `\\boxed{${input.finalAnswerLatex}}`,
        step_en: "Box the final answer after the algebra is written.",
        step_fr: "Encadrer la réponse après l’algèbre écrite.",
        text: L("Box the final answer after the algebra is written.", "Encadrer la réponse après l’algèbre écrite."),
        index: exampleActions.length + 1,
        boxed: true,
        marks: "barème",
      },
    });
  }

  return {
    id: createId("solve"),
    title: L(
      `${input.topic} — ${INSTRUCTOR_EN}`,
      `${input.topic} — ${INSTRUCTOR_EN}`,
      `${input.topic} — ${INSTRUCTOR_AR}`,
    ),
    language: input.language === "fr" ? "fr" : "en",
    defaultLanguage: input.language === "fr" ? "fr" : "en",
    durationSec: trapEnd,
    instructor: INSTRUCTOR_EN,
    track: input.track,
    topic: input.topic,
    media: {
      poster: DEMO_POSTER,
      videoUrl: DEMO_AVATAR_VIDEO,
      studentEnabled: true,
    },
    chapters: [
      { id: "intro", at: 0, label: L("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve", "الفكرة الأساسية") },
      { id: "domain", at: Math.round(introEnd * 0.45), label: L("Domain D_f", "Ensemble D_f", "مجموعة التعريف") },
      { id: "limits", at: introEnd, label: L("Limits & asymptotes", "Limites et asymptotes", "النهايات والمقاربات") },
      { id: "variation", at: introEnd + Math.round(input.ruleDur * 0.4), label: L("Derivative / variation", "Dérivée / variation", "المشتق والتغيرات") },
      { id: "graph", at: introEnd + Math.round(input.ruleDur * 0.7), label: L("Points & graph", "Points et graphe", "النقاط والرسم") },
      { id: "steps", at: ruleEnd, label: L("Boxed exercise", "Exercice encadré", "التمرين المؤطّر") },
      { id: "trap", at: exampleEnd, label: L("Common pitfalls", "Pièges fréquents", "أخطاء شائعة") },
    ],
    segments: [
      {
        id: "introduction",
        start: 0,
        end: introEnd,
        phase: "introduction",
        label: L("1. Key Idea & domain", "1. Idée clé et ensemble de définition", "١. الفكرة ومجموعة التعريف"),
        avatar: { state: "speaking" },
        narration: L(
          `I am ${INSTRUCTOR_EN}. ${input.examTip.en} Question: ${input.question}. Official sequence: ${sequenceLine()}. ${input.summary}`,
          `Je suis ${INSTRUCTOR_EN}. ${input.examTip.fr} Énoncé : ${input.question}. Suite officielle : ${sequenceLineFr()}. ${input.summary}`,
          `أنا ${INSTRUCTOR_AR}. ${input.examTip.ar || input.examTip.en} السؤال: ${input.question}.`,
        ),
        canvas: {
          actions: [
            {
              at: 1,
              type: "exam_tip",
              latex: "\\text{Key Idea / Exam Tip}",
              payload: {
                latex: "\\text{Key Idea / Exam Tip}",
                caption: L("Key Idea / Exam Tip", "Idée clé / Conseil d’épreuve"),
                step_en: input.examTip.en,
                step_fr: input.examTip.fr,
                text: L(input.examTip.en, input.examTip.fr, input.examTip.ar),
              },
            },
            {
              at: 10,
              type: "renderMath",
              latex: input.question.slice(0, 120),
              payload: { latex: input.question.slice(0, 120), caption: L("Given", "Donnée", "المعطى") },
            },
            {
              at: 18,
              type: "show_step",
              latex: "D_f\\text{ first}",
              payload: {
                latex: "D_f\\text{ first}",
                math_latex: "D_f\\text{ first}",
                step_en: "Write the domain of definition D_f before any limit or derivative.",
                step_fr: "Écrire l’ensemble de définition D_f avant toute limite ou dérivée.",
                text: L(
                  "Write the domain of definition D_f before any limit or derivative.",
                  "Écrire l’ensemble de définition D_f avant toute limite ou dérivée.",
                ),
              },
            },
          ],
        },
      },
      {
        id: "rule-graph",
        start: introEnd,
        end: ruleEnd,
        phase: "rule_graph",
        label: L("2. Limits, variation, graph", "2. Limites, variation, graphe", "٢. النهايات والتغيرات والرسم"),
        avatar: { state: "paused" },
        narration: L(
          `Look at the board. Limits at the boundaries, then asymptote equations ${asymptoteLatex}, then the derivative and the table of variations, then C_f. Study kind: ${input.studyKind}.`,
          `Regardez le tableau. Limites aux bornes, puis équations d’asymptotes ${asymptoteLatex}, puis la dérivée et le tableau de variation, puis C_f. Type d’étude : ${input.studyKind}.`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_step",
              latex: `\\text{asymptotes: }${asymptoteLatex}`,
              payload: {
                latex: `\\text{asymptotes: }${asymptoteLatex}`,
                math_latex: `\\text{asymptotes: }${asymptoteLatex}`,
                step_en: "Limits at the boundaries. Write x=a, y=b, or y=ax+b. Never leave (−∞)×0.",
                step_fr: "Limites aux bornes. Écrire x=a, y=b ou y=ax+b. Ne jamais laisser (−∞)×0.",
                text: L(
                  "Limits at the boundaries. Write x=a, y=b, or y=ax+b. Never leave (−∞)×0.",
                  "Limites aux bornes. Écrire x=a, y=b ou y=ax+b. Ne jamais laisser (−∞)×0.",
                ),
              },
            },
            {
              at: 16,
              type: "variationTable",
              latex: input.steps.find((step) => /array|f'\s*\(/.test(step.latex))?.latex || DEFAULT_VARIATION_TABLE,
              payload: {
                latex: input.steps.find((step) => /array|f'\s*\(/.test(step.latex))?.latex || DEFAULT_VARIATION_TABLE,
                math_latex: input.steps.find((step) => /array|f'\s*\(/.test(step.latex))?.latex || DEFAULT_VARIATION_TABLE,
                step_en: "Derivative, sign chart, table of variations (arrows, limits, images).",
                step_fr: "Dérivée, signe, tableau de variation (flèches, limites, images).",
                text: L(
                  "Derivative, sign chart, table of variations (arrows, limits, images).",
                  "Dérivée, signe, tableau de variation (flèches, limites, images).",
                ),
              },
            },
            {
              at: 28,
              type: "plotFunction",
              latex: input.finalAnswerLatex,
              expression: input.graph.fn,
              domain,
              highlights: input.graph.highlights,
              payload: {
                kind: "function",
                fn: input.graph.fn,
                expression: input.graph.fn,
                domain,
                xDomain: domain,
                yDomain: input.graph.yDomain,
                highlights: input.graph.highlights,
                title: L("Particular points & C_f", "Points particuliers et C_f"),
              },
            },
          ],
        },
      },
      {
        id: "real-example",
        start: ruleEnd,
        end: exampleEnd,
        phase: "real_example",
        label: L("3. Graded solution", "3. Solution notée", "٣. الحل المفصّل"),
        avatar: { state: "speaking" },
        narration: L(
          `Now the graded lines. Each sub-question ends in a Boxed Final Answer. The boxed answer is ${input.finalAnswer}.`,
          `Les lignes notées. Chaque sous-question se termine par une réponse encadrée. La réponse encadrée est ${input.finalAnswer}.`,
        ),
        canvas: { actions: exampleActions },
      },
      {
        id: "common-mistake",
        start: exampleEnd,
        end: trapEnd,
        phase: "common_mistake",
        label: L("4. Common pitfalls", "4. Pièges fréquents", "٤. أخطاء شائعة"),
        avatar: { state: "speaking" },
        narration: L(
          `Common pitfalls that lose barème marks: ${input.trap.wrong} Correction: ${input.trap.correction}`,
          `Pièges fréquents (barème) : ${input.trap.wrongFr} Correction : ${input.trap.correctionFr}`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "fade_equation",
              latex: "\\text{do not skip the hypothesis}",
              payload: { caption: L("Wrong shortcut", "Raccourci faux") },
            },
            {
              at: 12,
              type: "show_step",
              latex: input.trap.latex,
              payload: {
                latex: input.trap.latex,
                math_latex: input.trap.latex,
                step_en: input.trap.correction,
                step_fr: input.trap.correctionFr,
                text: L(input.trap.correction, input.trap.correctionFr),
              },
            },
          ],
        },
      },
    ],
  };
}

export function attachDemoMedia(timeline: LessonTimeline, videoUrl?: string, jobId?: string): LessonTimeline {
  return {
    ...timeline,
    media: {
      ...(timeline.media ?? {}),
      poster: DEMO_POSTER,
      videoUrl: videoUrl || timeline.media?.videoUrl || DEMO_AVATAR_VIDEO,
      heygenJobId: jobId ?? timeline.media?.heygenJobId,
      studentEnabled: true,
    },
  };
}
