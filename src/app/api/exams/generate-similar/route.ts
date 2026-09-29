import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { userHasAiAccess } from "@/lib/auth/store";
import { generateSimilarQuestions } from "@/lib/exams/generateSimilar";
import { saveGeneratedSet } from "@/lib/exams/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role) && !(await userHasAiAccess(user))) {
    return NextResponse.json(
      { error: "AI access required.", errorAr: "يلزم اشتراك الذكاء." },
      { status: 403 },
    );
  }

  let body: { paperId?: string; questionId?: string; count?: number; save?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.paperId?.trim()) {
    return NextResponse.json({ error: "paperId is required." }, { status: 400 });
  }

  try {
    const { set, paper } = await generateSimilarQuestions({
      paperId: body.paperId.trim(),
      questionId: body.questionId?.trim() || undefined,
      count: body.count,
      userId: user.id,
    });
    if (body.save !== false) {
      await saveGeneratedSet(set);
    }
    return NextResponse.json({
      ok: true,
      set,
      paper: { id: paper.id, title: paper.title, track: paper.track },
      note:
        set.source === "demo"
          ? "Deterministic SAT-style variants (no Gemini/OpenAI key)."
          : "LLM-generated variants.",
      noteAr:
        set.source === "demo"
          ? "أسئلة مشابهة حتمية (بدون مفتاح Gemini/OpenAI)."
          : "أسئلة مولَّدة بالذكاء الاصطناعي.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generate failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
