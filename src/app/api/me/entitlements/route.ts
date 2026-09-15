import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { buildAccessPayload } from "@/lib/auth/accessPayload";
import { publishedLessons } from "@/lib/auth/entitlements";
import { canAccessLesson } from "@/lib/access";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireSession();
  if (!gate.ok) return gate.error;
  const access = buildAccessPayload(gate.user);
  const lessons = publishedLessons().map((lesson) => ({
    id: lesson.id,
    track: lesson.track,
    chapter: lesson.chapter,
    title: lesson.title,
    arabicTitle: lesson.arabicTitle,
    enabled: lesson.enabled,
    preview: lesson.chapter <= 1,
    unlocked: canAccessLesson(lesson, access.entitlements, gate.user.role),
  }));
  return NextResponse.json({ ...access, lessons });
}
