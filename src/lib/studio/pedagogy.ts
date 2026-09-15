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

function bilingual(ar: string, en: string) {
  return { ar, en };
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
  if (!rule.canvas.actions.some((action) => action.type === "render_graph")) {
    rule.canvas.actions.push({
      at: Math.min(8, Math.max(1, rule.end - rule.start - 2)),
      type: "render_graph",
      payload: {
        kind: "function",
        fn: "exp(x)",
        xDomain: [-2, 2],
        yDomain: [-1, 8],
        title: bilingual("رسم بياني إلزامي", "Mandatory graph"),
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
          text: bilingual("اكتب المعطى ثم القانون ثم التعويض.", "Write given, then the rule, then substitution."),
        },
      },
      {
        at: 18,
        type: "show_step",
        payload: {
          latex: "\\text{Check by substitution}",
          text: bilingual("تحقق بالتعويض قبل تأطير الناتج.", "Check by substitution before boxing the answer."),
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
        `نعرّف ${topic} كما يرد في الامتحانات اللبنانية الرسمية.`,
        `We define ${topic} as it appears in Lebanese official exams.`,
      ),
      canvas: {
        actions: [
          {
            at: 2,
            type: "show_equation",
            payload: {
              latex: "\\text{" + topic.replace(/[\\{}]/g, "") + "}",
              caption: bilingual("تعريف الفكرة", "Concept definition"),
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
        "نتوقف عند السبورة لنرسم القاعدة ونعلّم الجذور والتقارب والنهايات إن وُجدت.",
        "We freeze at the board to draw the rule and mark roots, asymptotes, and extrema when they exist.",
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
              title: bilingual("الرسم الإلزامي", "Mandatory graph"),
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
        `مثال محلول كامل على ${topic} مع تعويض وتحقق.`,
        `A full worked example on ${topic} with substitution and a check.`,
      ),
      canvas: {
        actions: [
          {
            at: 4,
            type: "show_step",
            payload: {
              latex: "\\text{step 1}",
              text: bilingual("خطوة بعد خطوة", "Step by step"),
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
      "تحذير من الخطأ الشائع في النماذج الرسمية.",
      "A warning about the typical official-exam mistake.",
    ),
    canvas: {
      actions: [
        {
          at: 3,
          type: "show_equation",
          payload: {
            latex: "\\text{Check the hypothesis before the formula.}",
            caption: bilingual("خطأ شائع", "Common mistake"),
          },
        },
      ],
    },
  };
}

export { shiftActions, PHASE_DURATION };
