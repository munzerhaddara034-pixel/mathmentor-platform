import { NextResponse } from "next/server";
import { livekitEnv } from "@/lib/livekit/config";
import { classroomGuard, sanitizeRoomName } from "@/lib/livekit/rooms";
import { boardDelta, parseSince, roomEtag, sinceFromEtag, type BoardOp } from "@/lib/livekit/roomState";
import { appendBoardOp, getClassroomRoom } from "@/lib/livekit/store";
import { sanitizeStroke } from "@/lib/livekit/strokeCodec";
import { parseSafeExpression } from "@/lib/math/safeExpression";
import type { WhiteboardEquation, WhiteboardPlot } from "@/lib/livekit/protocol";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-cache" };

/**
 * GET ?room=…&since=<version> → 304 when unchanged, else only newer items (`full:false`)
 * or the whole board (`full:true`, first load / after a clear). ETag/If-None-Match also work.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const room = sanitizeRoomName(url.searchParams.get("room") || "");
  const guard = await classroomGuard(room, (actor) => actor.staff);
  if (guard.error) return guard.error;
  try {
    const state = await getClassroomRoom(room);
    const etag = roomEtag(state);
    const since = parseSince(url.searchParams.get("since")) ?? sinceFromEtag(request.headers.get("if-none-match"));
    const delta = boardDelta(state, since);
    if (!delta) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, ...NO_STORE } });
    }
    return NextResponse.json({ ok: true, room, demo: !livekitEnv().configured, delta }, { headers: { ETag: etag, ...NO_STORE } });
  } catch (error) {
    console.error("[mathmentor] whiteboard read failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Board unavailable.", errorAr: "تعذّر تحميل السبورة." }, { status: 503 });
  }
}

type OpBody = {
  room?: string;
  op?: { kind?: string; stroke?: unknown; equation?: unknown; plot?: unknown };
};

function isString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** Board graphs render in every participant's browser: only the maths grammar may be stored. */
function isSafePlotExpression(expression: string): boolean {
  try {
    parseSafeExpression(expression);
    return true;
  } catch {
    return false;
  }
}

function parseOp(body: OpBody, authorId: string): BoardOp | null {
  const op = body.op;
  if (!op || typeof op.kind !== "string") return null;
  if (op.kind === "clear") return { kind: "clear" };
  if (op.kind === "stroke") {
    const stroke = sanitizeStroke(op.stroke, authorId);
    return stroke ? { kind: "stroke", stroke } : null;
  }
  if (op.kind === "equation" && typeof op.equation === "object" && op.equation !== null) {
    const raw = op.equation as Partial<WhiteboardEquation>;
    if (!isString(raw.id, 80) || !isString(raw.latex, 2000)) return null;
    return { kind: "equation", equation: { id: raw.id, latex: raw.latex, authorId, createdAt: new Date().toISOString() } };
  }
  if (op.kind === "plot" && typeof op.plot === "object" && op.plot !== null) {
    const raw = op.plot as Partial<WhiteboardPlot>;
    if (!isString(raw.id, 80) || !isString(raw.expression, 200)) return null;
    if (!isSafePlotExpression(raw.expression)) return null;
    const xMin = typeof raw.xMin === "number" && Number.isFinite(raw.xMin) ? raw.xMin : -5;
    const xMax = typeof raw.xMax === "number" && Number.isFinite(raw.xMax) ? raw.xMax : 5;
    return { kind: "plot", plot: { id: raw.id, expression: raw.expression, xMin, xMax, authorId, createdAt: new Date().toISOString() } };
  }
  return null;
}

/** POST { room, op } — append one stroke/equation/plot, or clear (teacher only). */
export async function POST(request: Request) {
  let body: OpBody;
  try {
    body = (await request.json()) as OpBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON.", errorAr: "طلب غير صالح." }, { status: 400 });
  }
  const room = sanitizeRoomName(body.room || "");
  const guard = await classroomGuard(room, (actor) => actor.staff);
  if (guard.error) return guard.error;
  const { actor, access } = guard;
  try {
    const current = await getClassroomRoom(room);
    const canWrite = access.isTeacher || current.writers.includes(actor.identity);
    if (!canWrite || current.ended) {
      return NextResponse.json(
        { ok: false, error: "Whiteboard write is not granted.", errorAr: "الكتابة على السبورة غير مسموحة." },
        { status: 403 },
      );
    }
    const op = parseOp(body, actor.identity);
    if (!op) {
      return NextResponse.json({ ok: false, error: "Invalid board item.", errorAr: "عنصر غير صالح للسبورة." }, { status: 400 });
    }
    if (op.kind === "clear" && !access.isTeacher) {
      return NextResponse.json({ ok: false, error: "Only the teacher can clear the board.", errorAr: "مسح السبورة للأستاذ فقط." }, { status: 403 });
    }
    const state = await appendBoardOp(room, op);
    return NextResponse.json({ ok: true, version: state.version }, { headers: { ETag: roomEtag(state), ...NO_STORE } });
  } catch (error) {
    console.error("[mathmentor] whiteboard write failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Could not save to the board.", errorAr: "تعذّر الحفظ على السبورة." }, { status: 503 });
  }
}
