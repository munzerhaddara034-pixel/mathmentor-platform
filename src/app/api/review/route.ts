import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { updateDraft } from "@/lib/store";
import type { ReviewStatus } from "@/lib/types";

export async function POST(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as {
    id?: string;
    status?: ReviewStatus;
    professorNote?: string;
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "Missing review payload." }, { status: 400 });
  }
  const allowed: ReviewStatus[] = ["approved", "rejected", "changes_requested"];
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const draft = await updateDraft(body.id, {
    status: body.status,
    professorNote: body.professorNote,
    reviewedAt: new Date().toISOString(),
  });
  if (!draft) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }
  return NextResponse.json(draft);
}
