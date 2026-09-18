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

export const CANVAS_ACTION_TYPES = [
  "show_equation",
  "fade_equation",
  "render_graph",
  "highlight_point",
  "show_step",
  "clear",
  "quiz_mcq",
  "renderMath",
  "plotFunction",
  "variationTable",
  "boxAnswer",
  "exam_tip",
  "examTip",
] as const;

export const canvasActionTypeSchema = z.enum(CANVAS_ACTION_TYPES);
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
    "question",
    "choices",
    "options",
    "correctId",
    "answer",
    "explanation",
    "prompt",
    "boxed",
    "marks",
    "table",
    "examVerbEn",
    "examVerbFr",
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

export const lessonChapterSchema = z.object({
  id: z.string().min(1),
  at: z.number().min(0),
  label: bilingualSchema,
});
export type LessonChapter = z.infer<typeof lessonChapterSchema>;

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
    /** Chapter markers under the video; tap seeks video + canvas. */
    chapters: z.array(lessonChapterSchema).optional(),
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
  boxed?: boolean;
  kind?: "step" | "variation" | "boxed" | "exam_tip";
  marks?: string;
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
  steps: Array<{
    latex?: string;
    text?: Bilingual;
    index: number;
    appearedAt: number;
    boxed?: boolean;
    kind?: StepPayload["kind"];
  }>;
  examTips: Array<{ latex: string; text?: Bilingual; appearedAt: number }>;
  variationTables: Array<{ latex: string; text?: Bilingual; appearedAt: number }>;
  boxedAnswers: Array<{ latex: string; text?: Bilingual; appearedAt: number; marks?: string }>;
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
export const TEACHER_MODE_STORAGE_KEY = "mathmentor.teacherMode";
export const DEMO_ROLE_STORAGE_KEY = "mathmentor.demoRole";
export const EVENTS_STORAGE_KEY_PREFIX = "mathmentor.timelineEvents:";

export function eventsStorageKey(lessonId: string) {
  return `${EVENTS_STORAGE_KEY_PREFIX}${lessonId}`;
}

export function validateTimelineEvents(input: unknown):
  | { ok: true; events: CanvasAction[] }
  | { ok: false; messageEn: string; messageAr: string } {
  const parsed = z.array(canvasActionSchema).safeParse(input);
  if (parsed.success) return { ok: true, events: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path?.length ? issue.path.join(".") : "events";
  const detail = issue?.message ?? "Invalid event";
  return {
    ok: false,
    messageEn: `Invalid timeline JSON (${path}): ${detail}`,
    messageAr: `JSON الخط الزمني غير صالح (${path}): ${detail}`,
  };
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
    examTips: [],
    variationTables: [],
    boxedAnswers: [],
    graph: null,
    highlights: [],
    graphStartedAt: null,
    lastActionType: null,
  };
}

export function normalizedActionType(type: CanvasActionType): CanvasActionType {
  if (type === "renderMath") return "show_equation";
  if (type === "plotFunction") return "render_graph";
  if (type === "examTip") return "exam_tip";
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

function highlightKey(item: HighlightPayload) {
  return `${item.kind ?? ""}:${item.x ?? ""}:${item.y ?? ""}:${item.axis ?? ""}:${item.value ?? ""}`;
}

function mergeHighlights(state: DerivedCanvasState, items: HighlightPayload[]) {
  const seen = new Set(state.highlights.map(highlightKey));
  for (const item of items) {
    const key = highlightKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    state.highlights.push(item);
  }
}

function applyAction(state: DerivedCanvasState, action: CanvasAction, abs: number, stepIndex: number): number {
  const lifted = liftTimelineEvent(action) as CanvasAction;
  const type = normalizedActionType(lifted.type);
  if (type === "quiz_mcq") return stepIndex;
  state.lastActionType = type;
  const payload = (lifted.payload ?? {}) as Record<string, unknown>;

  if (type === "clear") {
    state.equations = [];
    state.steps = [];
    state.examTips = [];
    state.variationTables = [];
    state.boxedAnswers = [];
    state.graph = null;
    state.highlights = [];
    state.graphStartedAt = null;
    return 0;
  }

  if (type === "exam_tip") {
    const latex = latexOf(payload);
    const text = stepTextOf(payload) ?? coerceBilingual(payload.caption);
    state.examTips.push({ latex, text, appearedAt: abs });
    if (latex) {
      state.equations.push({
        latex,
        caption: coerceBilingual(payload.caption) ?? { en: "Key Idea / Exam Tip", fr: "Idée clé / Conseil d’épreuve" },
        appearedAt: abs,
        fade: true,
      });
    }
    return stepIndex;
  }

  if (type === "variationTable") {
    const latex = latexOf(payload);
    const text = stepTextOf(payload);
    state.variationTables.push({ latex, text, appearedAt: abs });
    const next = stepIndex + 1;
    state.steps.push({
      latex: latex || undefined,
      text,
      index: typeof payload.index === "number" ? payload.index : next,
      appearedAt: abs,
      kind: "variation",
    });
    return next;
  }

  if (type === "boxAnswer") {
    const latex = latexOf(payload);
    const text = stepTextOf(payload);
    const marks = typeof payload.marks === "string" ? payload.marks : undefined;
    state.boxedAnswers.push({ latex, text, appearedAt: abs, marks });
    const next = stepIndex + 1;
    state.steps.push({
      latex: latex || undefined,
      text,
      index: typeof payload.index === "number" ? payload.index : next,
      appearedAt: abs,
      boxed: true,
      kind: "boxed",
    });
    return next;
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
    if (bundled.length) mergeHighlights(state, bundled);
    return stepIndex;
  }

  if (type === "show_step") {
    const next = stepIndex + 1;
    const boxed = payload.boxed === true;
    const kind: StepPayload["kind"] = boxed ? "boxed" : "step";
    const latex = latexOf(payload) || undefined;
    const text = stepTextOf(payload);
    state.steps.push({
      latex,
      text,
      index: typeof payload.index === "number" ? payload.index : next,
      appearedAt: abs,
      boxed,
      kind,
    });
    if (boxed && latex) {
      state.boxedAnswers.push({
        latex,
        text,
        appearedAt: abs,
        marks: typeof payload.marks === "string" ? payload.marks : undefined,
      });
    }
    return next;
  }

  if (type === "render_graph") {
    state.graph = asGraph(payload);
    state.graphStartedAt = abs;
    const bundled = parseHighlightsBundle(payload.highlights);
    if (bundled.length) mergeHighlights(state, bundled);
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
    if (bundled.length) mergeHighlights(state, bundled);
    else mergeHighlights(state, [asHighlight(payload)]);
  }

  // quiz_mcq and unknown types do not mutate the board — canvasStateAt stays idempotent.
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

/** Explicit chapters, or one marker per segment if the lesson did not seed them. */
export function chaptersForTimeline(timeline: LessonTimeline): LessonChapter[] {
  if (timeline.chapters && timeline.chapters.length > 0) {
    return [...timeline.chapters].sort((a, b) => a.at - b.at);
  }
  return timeline.segments.map((segment) => ({
    id: segment.id,
    at: segment.start,
    label: segment.label ?? { en: segment.phase, fr: segment.phase },
  }));
}

export function chapterAt(chapters: LessonChapter[], timeSec: number): LessonChapter | undefined {
  let current = chapters[0];
  for (const chapter of chapters) {
    if (timeSec + 0.04 >= chapter.at) current = chapter;
    else break;
  }
  return current;
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

export function countExampleSteps(timeline: LessonTimeline) {
  const example = timeline.segments.find((segment) => segment.phase === "real_example");
  if (!example) return 0;
  return example.canvas.actions.filter((action) => {
    const type = normalizedActionType(action.type);
    return type === "show_step" || type === "boxAnswer" || type === "variationTable";
  }).length;
}

export function hasStepByStep(timeline: LessonTimeline) {
  return countExampleSteps(timeline) >= 1;
}

export function hasGradedExample(timeline: LessonTimeline, minSteps = 3) {
  return countExampleSteps(timeline) >= minSteps;
}

export function phaseOf(timeline: LessonTimeline, phase: LessonPhase) {
  return timeline.segments.find((segment) => segment.phase === phase);
}

function allActions(timeline: LessonTimeline): CanvasAction[] {
  const actions: CanvasAction[] = [];
  for (const segment of timeline.segments) actions.push(...segment.canvas.actions);
  if (timeline.events) actions.push(...timeline.events);
  return actions;
}

function actionBlob(action: CanvasAction): string {
  const payload = (action.payload ?? {}) as Record<string, unknown>;
  return [
    action.type,
    action.latex,
    payload.latex,
    payload.math_latex,
    payload.step_en,
    payload.step_fr,
    payload.caption,
  ]
    .map((value) => (value == null ? "" : typeof value === "string" ? value : JSON.stringify(value)))
    .join(" ")
    .toLowerCase();
}

export function hasExamTip(timeline: LessonTimeline) {
  return allActions(timeline).some((action) => {
    const type = normalizedActionType(action.type);
    if (type === "exam_tip") return true;
    return /exam tip|key idea|idée clé|conseil d’épreuve|conseil d'épreuve/.test(actionBlob(action));
  });
}

export function hasDomainStatement(timeline: LessonTimeline) {
  return allActions(timeline).some((action) => /d_f|ensemble de d[eé]finition|domain/.test(actionBlob(action)));
}

export function hasLimitsAsymptotes(timeline: LessonTimeline) {
  return allActions(timeline).some((action) =>
    /\\lim|asymptote|y\s*=\s*0|x\s*=\s*|y\s*=\s*a/.test(actionBlob(action)),
  );
}

export function hasVariationTable(timeline: LessonTimeline) {
  return allActions(timeline).some((action) => {
    const type = normalizedActionType(action.type);
    if (type === "variationTable") return true;
    return /tableau de variation|table of variation|begin\{array\}/.test(actionBlob(action));
  });
}

export function hasBoxedAnswer(timeline: LessonTimeline) {
  return allActions(timeline).some((action) => {
    const type = normalizedActionType(action.type);
    if (type === "boxAnswer") return true;
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    return payload.boxed === true || /\\boxed|box the|encadr/.test(actionBlob(action));
  });
}

export type PedagogyAudit = {
  phases: LessonPhase[];
  sequence: string[];
  hasExamTip: boolean;
  hasDomain: boolean;
  hasLimitsAsymptotes: boolean;
  hasVariationTable: boolean;
  hasRenderGraph: boolean;
  hasBoxedAnswer: boolean;
  hasStepByStepEquations: boolean;
  gradedSteps: number;
  gradedExampleReady: boolean;
};

export function auditPedagogy(timeline: LessonTimeline): PedagogyAudit {
  return {
    phases: timeline.segments.map((segment) => segment.phase),
    sequence: [
      "Key Idea / Exam Tip",
      "Domain D_f",
      "Limits & asymptotes",
      "Derivative / variation",
      "Points & graph",
      "Boxed exercise",
      "Common pitfalls",
    ],
    hasExamTip: hasExamTip(timeline),
    hasDomain: hasDomainStatement(timeline),
    hasLimitsAsymptotes: hasLimitsAsymptotes(timeline),
    hasVariationTable: hasVariationTable(timeline),
    hasRenderGraph: hasRenderGraph(timeline),
    hasBoxedAnswer: hasBoxedAnswer(timeline),
    hasStepByStepEquations: hasStepByStep(timeline),
    gradedSteps: countExampleSteps(timeline),
    gradedExampleReady: hasGradedExample(timeline),
  };
}
