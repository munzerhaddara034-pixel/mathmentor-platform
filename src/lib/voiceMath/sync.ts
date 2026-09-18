import type { CanvasAction, LessonTimeline } from "@/lib/studio/timeline";
import type { CanvasTimelineJson } from "@/lib/solver/types";
import type { WhisperSegment } from "./types";

function allTimedActions(timeline: LessonTimeline): CanvasAction[] {
  const timed: CanvasAction[] = [];
  for (const segment of timeline.segments) {
    for (const action of segment.canvas.actions) {
      timed.push({ ...action, at: segment.start + action.at });
    }
  }
  if (timeline.events) {
    for (const action of timeline.events) timed.push({ ...action });
  }
  timed.sort((a, b) => a.at - b.at);
  return timed;
}

function uniqueActions(actions: CanvasAction[]) {
  const seen = new Set<string>();
  const out: CanvasAction[] = [];
  for (const action of actions) {
    const payload = (action.payload ?? {}) as Record<string, unknown>;
    const key = `${action.type}:${payload.latex ?? action.latex ?? payload.math_latex ?? ""}:${payload.step_en ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out;
}

/**
 * Stretch canvas events across the recorded audio. Prefer Whisper segment
 * timestamps; otherwise equal-time chunks over `durationSec`.
 */
export function syncTimelineToAudio(
  timeline: LessonTimeline,
  opts: { durationSec?: number; segments?: WhisperSegment[] },
): { timeline: LessonTimeline; canvasTimeline: CanvasTimelineJson } {
  const source = uniqueActions(allTimedActions(timeline));
  const durationSec = Math.max(
    8,
    opts.durationSec && opts.durationSec > 0 ? opts.durationSec : timeline.durationSec,
  );
  const count = Math.max(1, source.length);
  const chunk = durationSec / count;
  const segments = (opts.segments ?? []).filter((item) => item.end > item.start);

  const remapped: CanvasAction[] = source.map((action, index) => {
    let at = index * chunk;
    if (segments.length) {
      const seg = segments[Math.min(index, segments.length - 1)];
      at = seg.start;
    }
    return { ...action, at: Math.max(0, Math.min(durationSec - 0.05, at)) };
  });

  const scale = durationSec / Math.max(1, timeline.durationSec);
  const segmentsOut = timeline.segments.map((segment) => ({
    ...segment,
    start: Math.round(segment.start * scale * 100) / 100,
    end: Math.round(segment.end * scale * 100) / 100,
    canvas: {
      actions: segment.canvas.actions.map((action) => ({
        ...action,
        at: Math.round(action.at * scale * 100) / 100,
      })),
    },
  }));

  const next: LessonTimeline = {
    ...timeline,
    durationSec,
    segments: segmentsOut,
    events: remapped,
    chapters: (timeline.chapters ?? []).map((chapter) => ({
      ...chapter,
      at: Math.min(durationSec - 0.05, chapter.at * scale),
    })),
  };

  return {
    timeline: next,
    canvasTimeline: {
      durationSec,
      events: remapped.map((action) => {
        const payload = (action.payload ?? {}) as Record<string, unknown>;
        return {
          at: action.at,
          type: action.type,
          latex: typeof action.latex === "string" ? action.latex : typeof payload.latex === "string" ? String(payload.latex) : undefined,
          expression:
            typeof payload.fn === "string"
              ? String(payload.fn)
              : typeof action.expression === "string"
                ? action.expression
                : undefined,
          domain: Array.isArray(payload.domain)
            ? (payload.domain as [number, number])
            : Array.isArray(action.domain)
              ? (action.domain as [number, number])
              : undefined,
          highlights: payload.highlights ?? action.highlights,
          caption: payload.caption as CanvasTimelineJson["events"][number]["caption"],
          math_latex: typeof payload.math_latex === "string" ? String(payload.math_latex) : undefined,
          step_en: typeof payload.step_en === "string" ? String(payload.step_en) : undefined,
          step_fr: typeof payload.step_fr === "string" ? String(payload.step_fr) : undefined,
        };
      }),
      chapters: next.chapters,
    },
  };
}

export function attachTeacherAudio(
  timeline: LessonTimeline,
  audioUrl: string | undefined,
  opts?: { videoUrl?: string | null; poster?: string; heygenJobId?: string },
) {
  const videoUrl =
    opts?.videoUrl === null ? undefined : opts?.videoUrl !== undefined ? opts.videoUrl : timeline.media?.videoUrl;
  return {
    ...timeline,
    media: {
      ...(timeline.media ?? {}),
      audioUrl: audioUrl || timeline.media?.audioUrl,
      poster: opts?.poster ?? timeline.media?.poster ?? "/teachers/munzer.jpg?v=4",
      videoUrl,
      heygenJobId: opts?.heygenJobId ?? timeline.media?.heygenJobId,
      studentEnabled: true,
    },
  };
}
