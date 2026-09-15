import { z } from "zod";

export const bilingualSchema = z.object({
  ar: z.string(),
  en: z.string(),
});

export type Bilingual = z.infer<typeof bilingualSchema>;

export const lessonLanguageSchema = z.enum(["ar", "en"]);
export type LessonLanguage = z.infer<typeof lessonLanguageSchema>;

export const lessonPhaseSchema = z.enum([
  "introduction",
  "rule_graph",
  "real_example",
  "common_mistake",
]);
export type LessonPhase = z.infer<typeof lessonPhaseSchema>;

export const avatarStateSchema = z.enum(["speaking", "paused"]);
export type AvatarState = z.infer<typeof avatarStateSchema>;

export const canvasActionTypeSchema = z.enum([
  "show_equation",
  "render_graph",
  "highlight_point",
  "show_step",
  "clear",
]);
export type CanvasActionType = z.infer<typeof canvasActionTypeSchema>;

export const highlightKindSchema = z.enum(["root", "asymptote", "extrema", "point"]);
export type HighlightKind = z.infer<typeof highlightKindSchema>;

export const graphKindSchema = z.enum(["function", "argand"]);
export type GraphKind = z.infer<typeof graphKindSchema>;

export const certificateTrackSchema = z.enum([
  "brevet",
  "ls",
  "se",
  "gs",
  "lh",
  "eb7",
  "eb8",
  "s1",
  "sat",
]);
export type CertificateTrack = z.infer<typeof certificateTrackSchema>;

export const canvasActionSchema = z.object({
  at: z.number().min(0),
  type: canvasActionTypeSchema,
  payload: z.record(z.unknown()).default({}),
});
export type CanvasAction = z.infer<typeof canvasActionSchema>;

export const lessonSegmentSchema = z.object({
  id: z.string().min(1),
  start: z.number().min(0),
  end: z.number().positive(),
  phase: lessonPhaseSchema,
  narration: bilingualSchema,
  avatar: z.object({ state: avatarStateSchema }),
  canvas: z.object({
    actions: z.array(canvasActionSchema),
  }),
});
export type LessonSegment = z.infer<typeof lessonSegmentSchema>;

export const lessonMediaSchema = z
  .object({
    videoUrl: z.string().optional(),
    audioUrl: z.string().optional(),
    poster: z.string().optional(),
    heygenVideoId: z.string().optional(),
  })
  .optional();

export const lessonTimelineSchema = z
  .object({
    id: z.string().min(1),
    title: bilingualSchema,
    language: lessonLanguageSchema,
    durationSec: z.number().positive(),
    track: certificateTrackSchema.optional(),
    grade: z.string().optional(),
    topic: z.string().optional(),
    media: lessonMediaSchema,
    segments: z.array(lessonSegmentSchema).min(1),
  })
  .superRefine((value, ctx) => {
    if (value.segments.some((segment) => segment.end <= segment.start)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Each segment must have end > start." });
    }
  });

export type LessonTimeline = z.infer<typeof lessonTimelineSchema>;

export type EquationPayload = {
  latex?: string;
  caption?: Bilingual;
};

export type StepPayload = {
  latex?: string;
  text?: Bilingual;
  index?: number;
};

export type GraphPoint = {
  x: number;
  y: number;
  label?: Bilingual;
  kind?: HighlightKind;
};

export type GraphPayload = {
  kind?: GraphKind;
  fn?: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  title?: Bilingual;
  samples?: number;
  points?: GraphPoint[];
};

export type HighlightPayload = {
  kind?: HighlightKind;
  x?: number;
  y?: number;
  axis?: "x" | "y";
  value?: number;
  label?: Bilingual;
};

export type DerivedCanvasState = {
  equations: Array<{ latex: string; caption?: Bilingual }>;
  steps: Array<{ latex?: string; text?: Bilingual; index: number }>;
  graph: GraphPayload | null;
  highlights: HighlightPayload[];
  graphStartedAt: number | null;
  lastActionType: CanvasActionType | null;
};

export const REQUIRED_PHASES: LessonPhase[] = [
  "introduction",
  "rule_graph",
  "real_example",
  "common_mistake",
];

export const TIMELINE_STORAGE_KEY = "mathmentor.lessonTimeline";

export function pickText(value: Bilingual, language: LessonLanguage) {
  return value[language];
}

export function segmentAt(timeline: LessonTimeline, timeSec: number): LessonSegment | undefined {
  const t = clampTime(timeline, timeSec);
  return (
    timeline.segments.find((segment) => t >= segment.start && t < segment.end) ??
    timeline.segments.find((segment) => t === segment.end && segment.end === timeline.durationSec) ??
    timeline.segments[timeline.segments.length - 1]
  );
}

export function actionAbsoluteTime(segment: LessonSegment, action: CanvasAction) {
  return segment.start + action.at;
}

export function clampTime(timeline: LessonTimeline, timeSec: number) {
  if (Number.isNaN(timeSec) || timeSec < 0) return 0;
  return Math.min(timeSec, timeline.durationSec);
}

function asBilingual(value: unknown): Bilingual | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.ar === "string" && typeof record.en === "string") {
    return { ar: record.ar, en: record.en };
  }
  return undefined;
}

function asGraph(value: Record<string, unknown>): GraphPayload {
  const xDomain = Array.isArray(value.xDomain) ? (value.xDomain as [number, number]) : undefined;
  const yDomain = Array.isArray(value.yDomain) ? (value.yDomain as [number, number]) : undefined;
  const points = Array.isArray(value.points)
    ? (value.points as Array<Record<string, unknown>>).map((point) => ({
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
        label: asBilingual(point.label),
        kind: highlightKindSchema.safeParse(point.kind).success
          ? (point.kind as HighlightKind)
          : undefined,
      }))
    : undefined;
  return {
    kind: graphKindSchema.safeParse(value.kind).success ? (value.kind as GraphKind) : "function",
    fn: typeof value.fn === "string" ? value.fn : undefined,
    xDomain,
    yDomain,
    title: asBilingual(value.title),
    samples: typeof value.samples === "number" ? value.samples : undefined,
    points,
  };
}

function asHighlight(value: Record<string, unknown>): HighlightPayload {
  return {
    kind: highlightKindSchema.safeParse(value.kind).success ? (value.kind as HighlightKind) : "point",
    x: typeof value.x === "number" ? value.x : undefined,
    y: typeof value.y === "number" ? value.y : undefined,
    axis: value.axis === "x" || value.axis === "y" ? value.axis : undefined,
    value: typeof value.value === "number" ? value.value : undefined,
    label: asBilingual(value.label),
  };
}

export function emptyCanvasState(): DerivedCanvasState {
  return {
    equations: [],
    steps: [],
    graph: null,
    highlights: [],
    graphStartedAt: null,
    lastActionType: null,
  };
}

export function canvasStateAt(timeline: LessonTimeline, timeSec: number): DerivedCanvasState {
  const t = clampTime(timeline, timeSec);
  const state = emptyCanvasState();
  let stepIndex = 0;

  for (const segment of timeline.segments) {
    const actions = [...segment.canvas.actions].sort((a, b) => a.at - b.at);
    for (const action of actions) {
      const abs = actionAbsoluteTime(segment, action);
      if (abs > t) continue;
      state.lastActionType = action.type;
      const payload = action.payload ?? {};

      if (action.type === "clear") {
        state.equations = [];
        state.steps = [];
        state.graph = null;
        state.highlights = [];
        state.graphStartedAt = null;
        stepIndex = 0;
        continue;
      }

      if (action.type === "show_equation") {
        const latex = typeof payload.latex === "string" ? payload.latex : "";
        if (latex) {
          state.equations.push({ latex, caption: asBilingual(payload.caption) });
        }
        continue;
      }

      if (action.type === "show_step") {
        stepIndex += 1;
        state.steps.push({
          latex: typeof payload.latex === "string" ? payload.latex : undefined,
          text: asBilingual(payload.text),
          index: typeof payload.index === "number" ? payload.index : stepIndex,
        });
        continue;
      }

      if (action.type === "render_graph") {
        state.graph = asGraph(payload);
        state.graphStartedAt = abs;
        continue;
      }

      if (action.type === "highlight_point") {
        state.highlights.push(asHighlight(payload));
      }
    }
  }

  return state;
}

export function graphIsAnimating(state: DerivedCanvasState, timeSec: number, windowSec = 4) {
  if (state.graphStartedAt == null) return false;
  return timeSec >= state.graphStartedAt && timeSec < state.graphStartedAt + windowSec;
}

export function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function parseLessonTimeline(input: unknown) {
  return lessonTimelineSchema.safeParse(input);
}

export function hasRenderGraph(timeline: LessonTimeline) {
  return timeline.segments.some((segment) =>
    segment.canvas.actions.some((action) => action.type === "render_graph"),
  );
}

export function hasStepByStep(timeline: LessonTimeline) {
  return timeline.segments.some(
    (segment) =>
      segment.phase === "real_example" &&
      segment.canvas.actions.some((action) => action.type === "show_step"),
  );
}

export function phaseOf(timeline: LessonTimeline, phase: LessonPhase) {
  return timeline.segments.find((segment) => segment.phase === phase);
}
