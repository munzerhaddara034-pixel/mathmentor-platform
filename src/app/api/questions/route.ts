import { NextResponse } from "next/server";
import { addCustomQuestion, readStore, updateCustomQuestion } from "@/lib/store";
import { createId } from "@/lib/ids";
import { formatLebaneseEquation, formatMathIslands } from "@/lib/math/lebaneseEquationFormat";
import type { Difficulty, QuizKind, QuizQuestion } from "@/lib/types";

function cleanQuestionFields(body: Partial<QuizQuestion>) {
  return {
    prompt: body.prompt ? formatMathIslands(body.prompt) : body.prompt,
    latex: body.latex ? formatLebaneseEquation(body.latex) : body.latex,
    options: body.options?.map(formatMathIslands),
    steps: body.steps?.map(formatMathIslands),
  };
}

export async function GET(request: Request) {
  const lessonId = new URL(request.url).searchParams.get("lessonId");
  const store = await readStore();
  const rows = lessonId ? store.customQuestions.filter((item) => item.lessonId === lessonId) : store.customQuestions;
  return NextResponse.json({ questions: rows });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<QuizQuestion>;
  if (!body.lessonId || !body.prompt || !body.options?.length) {
    return NextResponse.json({ error: "أدخل السؤال والخيارات والدرس" }, { status: 400 });
  }
  const cleaned = cleanQuestionFields(body);
  const question = await addCustomQuestion({
    id: createId("q"),
    lessonId: body.lessonId,
    difficulty: (body.difficulty ?? 2) as Difficulty,
    kind: (body.kind ?? "mcq") as QuizKind,
    prompt: cleaned.prompt ?? body.prompt,
    latex: cleaned.latex,
    imageUrl: body.imageUrl,
    options: cleaned.options ?? body.options,
    correctIndex: body.correctIndex ?? 0,
    steps: cleaned.steps?.length ? cleaned.steps : ["راجع القاعدة ثم تحقق بالتعويض."],
  });
  return NextResponse.json({ question });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as Partial<QuizQuestion> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const question = await updateCustomQuestion(body.id, { ...body, ...cleanQuestionFields(body) });
  if (!question) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ question });
}
