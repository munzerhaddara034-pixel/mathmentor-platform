import { L } from "./i18n";
import {
  REQUIRED_PHASES,
  hasRenderGraph,
  hasStepByStep,
  type CanvasAction,
  type LessonPhase,
  type LessonSegment,
  type LessonTimeline,
  type LessonLanguage,
} from "./timeline";

const PHASE_DURATION: Record<LessonPhase, number> = {
  introduction: 30,
  rule_graph: 60,
  real_example: 120,
  common_mistake: 30,
};

function bilingual(en: string, fr: string) {
  return L(en, fr);
}

function shiftActions(actions: CanvasAction[], extra = 0): CanvasAction[] {
  return actions.map((action) => ({ ...action, at: action.at + extra }));
}

export function ensurePedagogy(timeline: LessonTimeline): LessonTimeline {
  const byPhase = new Map<LessonPhase, LessonSegment>();
  for (const segment of timeline.segments) {
    if (!byPhase.has(segment.phase)) byPhase.set(segment.phase, segment);
  }

  let cursor = 0;
  const segments: LessonSegment[] = REQUIRED_PHASES.map((phase) => {
    const existing = byPhase.get(phase);
    const duration = existing ? Math.max(8, existing.end - existing.start) : PHASE_DURATION[phase];
    const start = cursor;
    const end = cursor + duration;
    cursor = end;

    if (existing) {
      return {
        ...existing,
        start,
        end,
        avatar: {
          state: phase === "rule_graph" ? "paused" : existing.avatar.state,
        },
        canvas: {
          actions: existing.canvas.actions.map((action) => ({
            ...action,
            at: Math.min(action.at, Math.max(0, duration - 1)),
          })),
        },
      };
    }

    return placeholderSegment(phase, start, end, timeline.language, timeline.title.en);
  });

  const next: LessonTimeline = {
    ...timeline,
    durationSec: cursor,
    segments,
  };

  const rule = next.segments.find((segment) => segment.phase === "rule_graph")!;
  if (!hasRenderGraph(next)) {
    rule.canvas.actions.push({
      at: Math.min(8, Math.max(1, rule.end - rule.start - 2)),
      type: "render_graph",
      payload: {
        kind: "function",
        fn: "exp(x)",
        xDomain: [-2, 2],
        yDomain: [-1, 8],
        title: bilingual("Mandatory graph", "Graphe obligatoire"),
      },
    });
  }

  const example = next.segments.find((segment) => segment.phase === "real_example")!;
  if (!example.canvas.actions.some((action) => action.type === "show_step")) {
    example.canvas.actions.push(
      {
        at: 6,
        type: "show_step",
        payload: {
          latex: "\\text{Given} \\to \\text{rule} \\to \\text{substitute}",
          text: bilingual("Write given, then the rule, then substitution.", "Écrivez les données, puis la règle, puis la substitution."),
        },
      },
      {
        at: 18,
        type: "show_step",
        payload: {
          latex: "\\text{Check by substitution}",
          text: bilingual("Check by substitution before boxing the answer.", "Vérifiez par substitution avant d’encadrer la réponse."),
        },
      },
    );
  }

  if (!hasRenderGraph(next) || !hasStepByStep(next)) {
    throw new Error("Pedagogy repair failed: missing Render Graph or Show Step triggers.");
  }

  return next;
}

function placeholderSegment(
  phase: LessonPhase,
  start: number,
  end: number,
  _language: LessonLanguage,
  topic: string,
): LessonSegment {
  const id = `${phase}-${start}`;
  if (phase === "introduction") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "speaking" },
      narration: bilingual(
        `We define ${topic} as it appears in Lebanese official exams (Brevet / Terminale LS, GS, SE).`,
        `Nous définissons ${topic} tel qu’il apparaît dans les examens officiels libanais (Brevet / Terminale LS, GS, SE).`,
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "\\text{" + topic.replace(/[\\{}]/g, "") + "}",
              caption: bilingual("Concept definition", "Définition"),
            },
          },
        ],
      },
    };
  }
  if (phase === "rule_graph") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "paused" },
      narration: bilingual(
        "We freeze at the board to draw the rule and mark roots, asymptotes, and extrema when they exist.",
        "Nous gelons l’avatar pour tracer la règle et marquer racines, asymptotes et extrema s’ils existent.",
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "render_graph",
            payload: {
              kind: "function",
              fn: "exp(x)",
              xDomain: [-2, 2],
              yDomain: [-1, 8],
              title: bilingual("Mandatory graph", "Graphe obligatoire"),
            },
          },
        ],
      },
    };
  }
  if (phase === "real_example") {
    return {
      id,
      start,
      end,
      phase,
      avatar: { state: "speaking" },
      narration: bilingual(
        `A full worked example on ${topic} with substitution and a check.`,
        `Un exemple entièrement résolu sur ${topic} avec substitution et vérification.`,
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "show_step",
            payload: {
              latex: "\\text{step 1}",
              text: bilingual("Step by step", "Étape par étape"),
            },
          },
        ],
      },
    };
  }
  return {
    id,
    start,
    end,
    phase,
    avatar: { state: "speaking" },
    narration: bilingual(
      "A warning about the typical official-exam mistake.",
      "Un avertissement sur l’erreur typique des examens officiels.",
    ),
    canvas: {
      actions: [
        {
          at: 3,
          type: "show_equation",
          payload: {
            latex: "\\text{Check the hypothesis before the formula.}",
            caption: bilingual("Common mistake", "Erreur fréquente"),
          },
        },
      ],
    },
  };
}

export { shiftActions, PHASE_DURATION };
