import { NextResponse } from "next/server";
import { CERTIFICATE_META, listExamPacks } from "@/lib/examCatalog";
import { topicBanks } from "@/lib/topicBanks";
import { requireRole } from "@/lib/auth/server";
import { listContentOverrides, publishedLessons, upsertContentOverride } from "@/lib/auth/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const lessons = publishedLessons();
  const banks = topicBanks.map((bank) => ({
    id: bank.id,
    title: bank.title,
    arabicTitle: bank.arabicTitle,
    certificate: bank.certificate,
    track: bank.track,
    questionCount: bank.questions.length,
  }));
  const certificates = Object.entries(CERTIFICATE_META).map(([id, meta]) => ({
    id,
    arabic: meta.arabic,
    english: meta.english,
  }));
  const packs = listExamPacks().map((pack) => ({
    id: pack.id,
    title: pack.title,
    arabicTitle: pack.arabicTitle,
    kind: pack.kind,
    certificate: pack.certificate,
    questionCount: pack.questionCount,
  }));
  return NextResponse.json({
    lessons,
    banks,
    certificates,
    packs: packs.filter((pack) => pack.kind !== "full-paper" || pack.id.includes("2024-ordinary")),
    overrides: listContentOverrides(),
  });
}

export async function PATCH(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as {
    key?: string;
    kind?: "lesson" | "bank" | "exam-cert";
    enabled?: boolean;
    title?: string | null;
    arabicTitle?: string | null;
    videoUrl?: string | null;
    videoUrlFr?: string | null;
    notes?: string | null;
  };
  if (!body.key || !body.kind) {
    return NextResponse.json({ error: "حدّد العنصر للتعديل" }, { status: 400 });
  }
  const override = upsertContentOverride({
    key: body.key,
    kind: body.kind,
    enabled: body.enabled,
    title: body.title,
    arabicTitle: body.arabicTitle,
    videoUrl: body.videoUrl,
    videoUrlFr: body.videoUrlFr,
    notes: body.notes,
  });
  return NextResponse.json({ override, lessons: publishedLessons() });
}
