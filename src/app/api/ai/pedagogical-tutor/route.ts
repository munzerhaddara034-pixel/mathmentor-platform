import { NextResponse } from "next/server";
import { apiRequireAiAccess } from "@/lib/auth/guards";
import { isCurriculumId } from "@/lib/curriculum/catalogs";
import { parseCurriculumId } from "@/lib/curriculum/persistence";
import type { CurriculumLanguage } from "@/lib/curriculum/types";
import { runPedagogicalTutor } from "@/lib/curriculum/tutor";
import type { TutorMode } from "@/lib/curriculum/tutorTypes";

export const runtime = "nodejs";
/** Netlify function budget — prefer 60s; fall back to 26 if the platform rejects higher. */
export const maxDuration = 60;

function asMode(value: unknown): TutorMode {
  return value === "socratic" ? "socratic" : "direct";
}

function asLanguage(value: unknown): CurriculumLanguage {
  return value === "ar" ? "ar" : "en";
}

export async function POST(request: Request) {
  const guard = await apiRequireAiAccess();
  if (guard.error) return guard.error;

  let body: {
    text?: string;
    latex?: string;
    imageBase64?: string;
    mimeType?: string;
    mode?: string;
    curriculumId?: string;
    language?: string;
    revealAnswer?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", errorAr: "جسم الطلب غير صالح." }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  const latex = body.latex?.trim() ?? "";
  const imageBase64 = body.imageBase64?.trim() || undefined;
  if (!text && !latex && !imageBase64) {
    return NextResponse.json(
      { error: "Provide text, LaTeX, or imageBase64.", errorAr: "أدخل نصاً أو LaTeX أو صورة." },
      { status: 400 },
    );
  }

  const curriculumId = isCurriculumId(body.curriculumId)
    ? body.curriculumId
    : parseCurriculumId(body.curriculumId);

  try {
    const result = await runPedagogicalTutor({
      text,
      latex,
      imageBase64,
      mimeType: body.mimeType,
      mode: asMode(body.mode),
      curriculumId,
      language: asLanguage(body.language),
      revealAnswer: body.revealAnswer === true,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tutor failed.";
    const gatewayish =
      /502|503|504|timeout|timed out|abort|gateway|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(
        message,
      );
    return NextResponse.json(
      {
        error: gatewayish
          ? `Gateway or upstream busy: ${message}. Retry in a moment.`
          : message,
        errorAr: gatewayish
          ? "بوابة الشبكة أو الخادم مشغولان. أعد المحاولة بعد لحظات…"
          : "تعذّر المعلّم البيداغوجي.",
      },
      { status: gatewayish ? 503 : 500 },
    );
  }
}
