import { NextResponse } from "next/server";
import { z } from "zod";
import { guardHeyGenAdmin } from "@/lib/studio/heygenAuth";
import { getStudioEvents, saveStudioEvents } from "@/lib/studio/studioEventsStore";
import { canvasActionSchema } from "@/lib/studio/timeline";

export const runtime = "nodejs";

const bodySchema = z.object({
  lessonId: z.string().min(1),
  events: z.array(canvasActionSchema),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lessonId = url.searchParams.get("lessonId")?.trim();
  if (!lessonId) {
    return NextResponse.json(
      { error: "lessonId is required.", errorAr: "معرّف الدرس مطلوب." },
      { status: 400 },
    );
  }
  const events = await getStudioEvents(lessonId);
  return NextResponse.json({ lessonId, events: events ?? null, saved: Array.isArray(events) });
}

export async function POST(request: Request) {
  const guard = guardHeyGenAdmin(request, { write: true });
  if (!guard.ok) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body.", errorAr: "نص JSON غير صالح." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "body";
    return NextResponse.json(
      {
        error: `Invalid timeline JSON (${path}): ${issue?.message ?? "invalid"}`,
        errorAr: `JSON الخط الزمني غير صالح (${path}): ${issue?.message ?? "غير صالح"}`,
      },
      { status: 400 },
    );
  }

  const saved = await saveStudioEvents(parsed.data.lessonId, parsed.data.events);
  return NextResponse.json({
    ok: true,
    lessonId: parsed.data.lessonId,
    events: saved.events,
    updatedAt: saved.updatedAt,
    notice: guard.notice,
    demoMode: guard.demoAuth,
  });
}
