import { createId } from "@/lib/ids";
import { L } from "@/lib/studio/i18n";
import { ensurePedagogy } from "@/lib/studio/pedagogy";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "@/lib/studio/heygenClient";
import type { CertificateTrack, LessonLanguage, LessonTimeline } from "@/lib/studio/timeline";
import type { AvatarScript, CanvasTimelineJson, MathSolution, SolverSource, SolverStep } from "./types";

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
  const steps = withTheorems(input.steps.length ? input.steps : fallbackSteps(input.question, input.finalAnswerLatex));
  const trap = input.trap ?? defaultTrap(input.finalAnswerLatex);
  const graph = input.graph ?? { fn: "x*x - 5*x + 6", domain: [-1, 6] as [number, number], highlights: { roots: [[2, 0], [3, 0]] } };

  const introDur = 22;
  const ruleDur = 48;
  const perStep = stepSeconds(steps.length);
  const exampleDur = Math.max(50, Math.round(perStep * Math.max(3, steps.length) + 8));
  const trapDur = 24;
  const durationSec = introDur + ruleDur + exampleDur + trapDur;

  const avatarScript = buildAvatarScript(input.question, steps, input.finalAnswer, trap, language);
  const timeline = ensurePedagogy(
    buildTimeline({
      question: input.question,
      summary: input.summary,
      finalAnswer: input.finalAnswer,
      finalAnswerLatex: input.finalAnswerLatex,
      steps,
      graph,
      trap,
      topic: input.topic,
      track,
      language,
      introDur,
      ruleDur,
      exampleDur,
      trapDur,
      durationSec,
    }),
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

  return {
    summary: input.summary,
    finalAnswer: input.finalAnswer,
    finalAnswerLatex: input.finalAnswerLatex,
    given: input.given ?? {
      latex: input.finalAnswerLatex || input.question.slice(0, 120),
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
  };
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
    correction: "Write given → rule → algebra → check. That is the MathMentor / Prof. Munzer Haddara barème.",
    correctionFr: "Données → règle → algèbre → vérification. C’est le barème de MathMentor / Prof. Munzer Haddara.",
    latex: latex || "\\text{hypothesis first}",
  };
}

function buildAvatarScript(
  question: string,
  steps: SolverStep[],
  finalAnswer: string,
  trap: TrapSpec,
  language: LessonLanguage,
): AvatarScript {
  const en = [
    `I am Prof. Munzer Haddara. Let us solve this together, line by line, as on a Lebanese official paper.`,
    `The question: ${question}.`,
    ...steps.map((step, index) => `Step ${index + 1}. ${step.explanationEn}`),
    `The final answer is ${finalAnswer}.`,
    `A common exam trap: ${trap.wrong} ${trap.correction}`,
  ].join(" ");

  const fr = [
    `Je suis le professeur Munzer Haddara. Nous résolvons ensemble, ligne par ligne, comme sur une copie officielle libanaise.`,
    `L’énoncé : ${question}.`,
    ...steps.map((step, index) => `Étape ${index + 1}. ${step.explanationFr}`),
    `La réponse finale est ${finalAnswer}.`,
    `Piège d’épreuve : ${trap.wrongFr} ${trap.correctionFr}`,
  ].join(" ");

  const ar = [
    `أنا الأستاذ منذر حداره. نحلّ المسألة سطراً بسطر كما في ورقة رسمية لبنانية.`,
    `السؤال: ${question}.`,
    ...steps.map((step, index) => `الخطوة ${index + 1}. ${step.explanationAr || step.explanationEn}`),
    `الجواب النهائي: ${finalAnswer}.`,
    `خطأ شائع في الامتحان: لا تقفز إلى الناتج قبل كتابة القانون والتحقق.`,
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

  const exampleActions = input.steps.map((step, index) => ({
    at: 4 + index * perStep,
    type: "show_step" as const,
    latex: step.latex,
    payload: {
      latex: step.latex,
      math_latex: step.latex,
      step_en: step.explanationEn,
      step_fr: step.explanationFr,
      text: L(step.explanationEn, step.explanationFr, step.explanationAr),
      index: index + 1,
    },
  }));

  while (exampleActions.length < 3) {
    exampleActions.push({
      at: 4 + exampleActions.length * perStep,
      type: "show_step",
      latex: input.finalAnswerLatex,
      payload: {
        latex: input.finalAnswerLatex,
        math_latex: input.finalAnswerLatex,
        step_en: "Box the final answer after the algebra is written.",
        step_fr: "Encadrer la réponse après l’algèbre écrite.",
        text: L("Box the final answer after the algebra is written.", "Encadrer la réponse après l’algèbre écrite."),
        index: exampleActions.length + 1,
      },
    });
  }

  return {
    id: createId("solve"),
    title: L(
      `${input.topic} — Prof. Munzer Haddara`,
      `${input.topic} — Prof. Munzer Haddara`,
      `${input.topic} — الأستاذ منذر حداره`,
    ),
    language: input.language === "fr" ? "fr" : "en",
    defaultLanguage: input.language === "fr" ? "fr" : "en",
    durationSec: trapEnd,
    instructor: "Prof. Munzer Haddara",
    track: input.track,
    topic: input.topic,
    media: {
      poster: DEMO_POSTER,
      videoUrl: DEMO_AVATAR_VIDEO,
      studentEnabled: true,
    },
    chapters: [
      { id: "intro", at: 0, label: L("Question", "Énoncé", "السؤال") },
      { id: "rule", at: introEnd, label: L("Rule + graph", "Règle + graphe", "القانون والرسم") },
      { id: "steps", at: ruleEnd, label: L("Worked steps", "Étapes", "الخطوات") },
      { id: "trap", at: exampleEnd, label: L("Exam trap", "Piège", "خطأ شائع") },
    ],
    segments: [
      {
        id: "introduction",
        start: 0,
        end: introEnd,
        phase: "introduction",
        label: L("1. Read the question", "1. Lire l’énoncé", "١. قراءة السؤال"),
        avatar: { state: "speaking" },
        narration: L(
          `I am Prof. Munzer Haddara. We work this as a Lebanese Brevet / Terminale paper: copy the given, name the certificate skill, then start the algebra. Question: ${input.question}. ${input.summary}`,
          `Je suis le professeur Munzer Haddara. On traite cela comme une copie Brevet / Terminale : recopier les données, nommer la compétence, puis l’algèbre. Énoncé : ${input.question}. ${input.summary}`,
          `أنا الأستاذ منذر حداره. نتعامل مع المسألة كورقة رسمية: نكتب المعطيات ثم القانون ثم الحساب. السؤال: ${input.question}.`,
        ),
        canvas: {
          actions: [
            {
              at: 2,
              type: "fade_equation",
              latex: input.question.slice(0, 120),
              payload: { latex: input.question.slice(0, 120), caption: L("Given", "Donnée", "المعطى") },
            },
            {
              at: 10,
              type: "show_equation",
              latex: input.summary,
              payload: { latex: input.summary, caption: L("Plan", "Plan", "الخطة") },
            },
          ],
        },
      },
      {
        id: "rule-graph",
        start: introEnd,
        end: ruleEnd,
        phase: "rule_graph",
        label: L("2. Rule and graph", "2. Règle et graphe", "٢. القانون والرسم"),
        avatar: { state: "paused" },
        narration: L(
          `Look at the board. We name the rule with its hypothesis, then we plot the model so the roots, extrema, or asymptotes are visible — never a slogan without a graph when the function is on the paper.`,
          `Regardez le tableau. On nomme la règle avec son hypothèse, puis on trace le modèle pour voir racines, extrema ou asymptotes — jamais un slogan sans graphe si la fonction est dans l’énoncé.`,
        ),
        canvas: {
          actions: [
            {
              at: 3,
              type: "show_equation",
              latex: input.steps[0]?.latex || input.finalAnswerLatex,
              payload: { caption: L("Named rule", "Règle nommée") },
            },
            {
              at: 14,
              type: "render_graph",
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
                title: L("Model graph", "Graphe modèle"),
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
          `Now the graded lines. Each step is substitution or algebra. The boxed answer is ${input.finalAnswer}.`,
          `Les lignes notées. Chaque étape est une substitution ou de l’algèbre. La réponse encadrée est ${input.finalAnswer}.`,
        ),
        canvas: { actions: exampleActions },
      },
      {
        id: "common-mistake",
        start: exampleEnd,
        end: trapEnd,
        phase: "common_mistake",
        label: L("4. Official-exam trap", "4. Piège d’épreuve", "٤. خطأ الامتحان"),
        avatar: { state: "speaking" },
        narration: L(
          `Exam trap: ${input.trap.wrong} Correction: ${input.trap.correction}`,
          `Piège : ${input.trap.wrongFr} Correction : ${input.trap.correctionFr}`,
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
