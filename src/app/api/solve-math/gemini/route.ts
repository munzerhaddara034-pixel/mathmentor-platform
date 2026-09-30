/**
 * Owner's direct Gemini solver (formerly POST/GET /api/solve-math).
 * /api/solve-math now serves the /math-solver UI (auth + AI tier, history, avatar timeline);
 * this route keeps the owner's contract: POST { problem | question | text } → { success, data }.
 */
import { NextRequest, NextResponse } from "next/server";
import { apiRequireAiAccess } from "@/lib/auth/guards";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

type SolveBody = { problem?: unknown; question?: unknown; text?: unknown };

export async function POST(req: NextRequest) {
  // Was open to anonymous callers (spends the Gemini key): require an AI-tier session.
  const aiGuard = await apiRequireAiAccess();
  if (aiGuard.error) return aiGuard.error;
  try {
    const body = (await req.json().catch(() => ({}))) as SolveBody;
    const candidate = [body.problem, body.question, body.text].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
    const problem = candidate ?? "";

    if (!problem) {
      return NextResponse.json({ error: "يرجى تقديم نص المسألة الرياضية المراد حلها." }, { status: 400 });
    }

    // التحقق من وجود مفتاح الذكاء الاصطناعي
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY غير معرّف في بيئة التشغيل.",
          demoMode: true,
          solution: "⚠️ تنبيه: يرجى إضافة GEMINI_API_KEY في إعدادات المنصة لتفعيل الحل الذكي المباشر.",
        },
        { status: 200 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
أنت معلم وخبير رياضيات لمنصة MathMentor.
المطلوب منك: حل المسألة الرياضية التالية حلًا مفصلًا، دقيقًا، خطوة بخطوة مع استخدام رموز LaTeX الرياضية عند الحاجة.
المسألة:
"""
${problem}
"""

قدم الناتج بصيغة JSON فقط:
{
  "summary": "ملخص النتيجة النهائية",
  "steps": [
    "الخطوة الأولى...",
    "الخطوة الثانية..."
  ],
  "finalAnswer": "الجواب النهائي"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsedData: unknown = JSON.parse(response.text || "{}");

    return NextResponse.json({
      success: true,
      problem,
      data: parsedData,
      raw: response.text,
    });
  } catch (error) {
    console.error("Math Solver Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ أثناء معالجة وحل المسألة الرياضية.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// مسار GET للتحقق من صحة المسار (Health Check)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "MathMentor Math Solver Engine",
    geminiConfigured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  });
}
