import { z } from "zod";
import { coerceBilingual, type Bilingual, type LessonLanguage, type LessonLocale } from "./i18n";
import { isSceneDocument, timelineFromScenes } from "./scenes";

export type { Bilingual, LessonLanguage, LessonLocale };
export { pickText, L, toLessonLocale } from "./i18n";

export const bilingualSchema = z.preprocess((value) => {
  const coerced = coerceBilingual(value);
  return coerced ?? { en: "", fr: "" };
}, z.object({
  en: z.string(),
  fr: z.string().optional(),
  ar: z.string().optional(),
}));

export const lessonLanguageSchema = z.enum(["en", "fr", "ar"]);
export const lessonLocaleSchema = z.enum(["en", "fr"]);

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
  "fade_equation",
  "render_graph",
  "highlight_point",
  "show_step",
  "clear",
  "renderMath",
  "plotFunction",
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

/** Lift flat timeline-event fields (`latex`, `expression`, `domain`, `highlights`) into `payload`. */
function liftTimelineEvent(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const rec = value as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    ...(rec.payload && typeof rec.payload === "object" ? (rec.payload as Record<string, unknown>) : {}),
  };
  for (const key of [
    "latex",
    "math_latex",
    "expression",
    "fn",
    "domain",
    "xDomain",
    "yDomain",
    "highlights",
    "caption",
    "kind",
  ]) {
    if (rec[key] !== undefined && payload[key] === undefined) payload[key] = rec[key];
  }
  return { ...rec, payload };
}

export const canvasActionSchema = z.preprocess(
  liftTimelineEvent,
  z
    .object({
      at: z.number().min(0),
      type: canvasActionTypeSchema,
      payload: z.record(z.unknown()).default({}),
      latex: z.string().optional(),
      expression: z.string().optional(),
      domain: z.array(z.number()).length(2).or(z.tuple([z.number(), z.number()])).optional(),
      highlights: z.unknown().optional(),
    })
    .passthrough(),
);
export type CanvasAction = z.infer<typeof canvasActionSchema>;

export const lessonSegmentSchema = z.object({
  id: z.string().min(1),
  start: z.number().min(0),
  end: z.number().positive(),
  phase: lessonPhaseSchema,
  label: bilingualSchema.optional(),
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
    heygenJobId: z.string().optional(),
    studentEnabled: z.boolean().optional(),
  })
  .optional();

export const lessonTimelineSchema = z
  .object({
    id: z.string().min(1),
    title: bilingualSchema,
    language: lessonLanguageSchema,
    defaultLanguage: lessonLocaleSchema.optional(),
    durationSec: z.number().positive(),
    instructor: z.string().optional(),
    track: certificateTrackSchema.optional(),
    grade: z.string().optional(),
    topic: z.string().optional(),
    media: lessonMediaSchema,
    scenes: z.array(z.unknown()).optional(),
    /** Absolute-time canvas events (`at` is seconds from lesson start). */
    events: z.array(canvasActionSchema).optional(),
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
  equations: Array<{ latex: string; caption?: Bilingual; appearedAt: number; fade: boolean }>;
  steps: Array<{ latex?: string; text?: Bilingual; index: number; appearedAt: number }>;
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

function pairDomain(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const a = Number(value[0]);
  const b = Number(value[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return [a, b];
}

function asGraph(value: Record<string, unknown>): GraphPayload {
  const xDomain = pairDomain(value.xDomain) ?? pairDomain(value.domain);
  const yDomain = pairDomain(value.yDomain);
  const points = Array.isArray(value.points)
    ? (value.points as Array<Record<string, unknown>>).map((point) => ({
        x: Number(point.x) || 0,
        y: Number(point.y) || 0,
        label: coerceBilingual(point.label),
        kind: highlightKindSchema.safeParse(point.kind).success
          ? (point.kind as HighlightKind)
          : undefined,
      }))
    : undefined;
  const fn = typeof value.fn === "string" ? value.fn : typeof value.expression === "string" ? value.expression : undefined;
  return {
    kind: graphKindSchema.safeParse(value.kind).success ? (value.kind as GraphKind) : "function",
    fn,
    xDomain: xDomain ?? [-3, 2],
    yDomain: yDomain ?? [-4, 8],
    title: coerceBilingual(value.title),
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
    label: coerceBilingual(value.label),
  };
}

function pairPoint(value: unknown): { x: number; y: number } | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const x = Number(rec.x);
    const y = Number(rec.y);
    if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  }
  return undefined;
}

/** `{ roots: [[1,0]], extrema: [[0,-1]], asymptotes: [{ y: 0 }] }` */
export function parseHighlightsBundle(value: unknown): HighlightPayload[] {
  if (!value || typeof value !== "object") return [];
  const rec = value as Record<string, unknown>;
  const out: HighlightPayload[] = [];
  if (Array.isArray(rec.roots)) {
    for (const item of rec.roots) {
      const point = pairPoint(item);
      if (point) out.push({ kind: "root", x: point.x, y: point.y, label: coerceBilingual((item as { label?: unknown })?.label) });
    }
  }
  if (Array.isArray(rec.extrema)) {
    for (const item of rec.extrema) {
      const point = pairPoint(item);
      if (point) out.push({ kind: "extrema", x: point.x, y: point.y, label: coerceBilingual((item as { label?: unknown })?.label) });
    }
  }
  if (Array.isArray(rec.asymptotes)) {
    for (const item of rec.asymptotes) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.y === "number") out.push({ kind: "asymptote", axis: "y", value: row.y, label: coerceBilingual(row.label) });
      else if (typeof row.x === "number") out.push({ kind: "asymptote", axis: "x", value: row.x, label: coerceBilingual(row.label) });
      else if ((row.axis === "x" || row.axis === "y") && typeof row.value === "number") {
        out.push({ kind: "asymptote", axis: row.axis, value: row.value, label: coerceBilingual(row.label) });
      }
    }
  }
  return out;
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

function normalizedActionType(type: CanvasActionType): CanvasActionType {
  if (type === "renderMath") return "show_equation";
  if (type === "plotFunction") return "render_graph";
  return type;
}

function latexOf(payload: Record<string, unknown>) {
  if (typeof payload.latex === "string" && payload.latex) return payload.latex;
  if (typeof payload.math_latex === "string" && payload.math_latex) return payload.math_latex;
  return "";
}

function stepTextOf(payload: Record<string, unknown>) {
  return (
    coerceBilingual(payload.text) ??
    coerceBilingual({ en: payload.step_en, fr: payload.step_fr })
  );
}

function applyAction(state: DerivedCanvasState, action: CanvasAction, abs: number, stepIndex: number): number {
  const lifted = liftTimelineEvent(action) as CanvasAction;
  const type = normalizedActionType(lifted.type);
  state.lastActionType = type;
  const payload = (lifted.payload ?? {}) as Record<string, unknown>;

  if (type === "clear") {
    state.equations = [];
    state.steps = [];
    state.graph = null;
    state.highlights = [];
    state.graphStartedAt = null;
    return 0;
  }

  if (type === "show_equation" || type === "fade_equation") {
    const latex = latexOf(payload);
    if (latex) {
      state.equations.push({
        latex,
        caption: coerceBilingual(payload.caption),
        appearedAt: abs,
        fade: true,
      });
    }
    const bundled = parseHighlightsBundle(payload.highlights);
    if (bundled.length) state.highlights.push(...bundled);
    return stepIndex;
  }

  if (type === "show_step") {
    const next = stepIndex + 1;
    state.steps.push({
      latex: latexOf(payload) || undefined,
      text: stepTextOf(payload),
      index: typeof payload.index === "number" ? payload.index : next,
      appearedAt: abs,
    });
    return next;
  }

  if (type === "render_graph") {
    state.graph = asGraph(payload);
    state.graphStartedAt = abs;
    const bundled = parseHighlightsBundle(payload.highlights);
    if (bundled.length) state.highlights.push(...bundled);
    const latex = latexOf(payload);
    if (latex && !state.equations.some((item) => item.latex === latex)) {
      state.equations.push({
        latex,
        caption: coerceBilingual(payload.caption),
        appearedAt: abs,
        fade: true,
      });
    }
    return stepIndex;
  }

  if (type === "highlight_point") {
    const bundled = parseHighlightsBundle(payload.highlights);
    if (bundled.length) state.highlights.push(...bundled);
    else state.highlights.push(asHighlight(payload));
  }
  return stepIndex;
}

export function canvasStateAt(timeline: LessonTimeline, timeSec: number): DerivedCanvasState {
  const t = clampTime(timeline, timeSec);
  const state = emptyCanvasState();
  let stepIndex = 0;

  const timed: Array<{ abs: number; action: CanvasAction }> = [];
  for (const segment of timeline.segments) {
    for (const action of segment.canvas.actions) {
      timed.push({ abs: actionAbsoluteTime(segment, action), action });
    }
  }
  for (const action of timeline.events ?? []) {
    timed.push({ abs: action.at, action });
  }
  timed.sort((a, b) => a.abs - b.abs);

  for (const item of timed) {
    if (item.abs > t) continue;
    stepIndex = applyAction(state, item.action, item.abs, stepIndex);
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
  if (isSceneDocument(input)) {
    const timeline = timelineFromScenes(input);
    return lessonTimelineSchema.safeParse(timeline);
  }
  return lessonTimelineSchema.safeParse(input);
}

export function hasRenderGraph(timeline: LessonTimeline) {
  const fromSegments = timeline.segments.some((segment) =>
    segment.canvas.actions.some((action) => normalizedActionType(action.type) === "render_graph"),
  );
  const fromEvents = (timeline.events ?? []).some((action) => normalizedActionType(action.type) === "render_graph");
  return fromSegments || fromEvents;
}

export function hasStepByStep(timeline: LessonTimeline) {
  return timeline.segments.some(
    (segment) =>
      segment.phase === "real_example" &&
      segment.canvas.actions.some((action) => normalizedActionType(action.type) === "show_step"),
  );
}

export function phaseOf(timeline: LessonTimeline, phase: LessonPhase) {
  return timeline.segments.find((segment) => segment.phase === phase);
}
