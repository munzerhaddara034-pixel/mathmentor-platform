import { NextResponse } from "next/server";
import { addCustomQuestion, readStore, updateCustomQuestion } from "@/lib/store";
import { createId } from "@/lib/ids";
import type { Difficulty, QuizKind, QuizQuestion } from "@/lib/types";
import { requireRole } from "@/lib/auth/server";

export async function GET(request: Request) {
  const lessonId = new URL(request.url).searchParams.get("lessonId");
  const store = await readStore();
  const rows = lessonId ? store.customQuestions.filter((item) => item.lessonId === lessonId) : store.customQuestions;
  return NextResponse.json({ questions: rows });
}

export async function POST(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as Partial<QuizQuestion>;
  if (!body.lessonId || !body.prompt || !body.options?.length) {
    return NextResponse.json({ error: "أدخل السؤال والخيارات والدرس" }, { status: 400 });
  }
  const question = await addCustomQuestion({
    id: createId("q"),
    lessonId: body.lessonId,
    difficulty: (body.difficulty ?? 2) as Difficulty,
    kind: (body.kind ?? "mcq") as QuizKind,
    prompt: body.prompt,
    latex: body.latex,
    imageUrl: body.imageUrl,
    options: body.options,
    correctIndex: body.correctIndex ?? 0,
    steps: body.steps?.length ? body.steps : ["راجع القاعدة ثم تحقق بالتعويض."],
  });
  return NextResponse.json({ question });
}

export async function PATCH(request: Request) {
  const gate = await requireRole(["teacher"]);
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as Partial<QuizQuestion> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const question = await updateCustomQuestion(body.id, body);
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ question });
}
