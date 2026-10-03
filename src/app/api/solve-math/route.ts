import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const problem = body.problem || body.question || body.text || "";

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "يرجى تقديم نص المسألة الرياضية المراد حلها." },
        { status: 400 }
      );
    }

    // التحقق من وجود مفتاح الذكاء الاصطناعي
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY غير معرّف في بيئة التشغيل.",
          demoMode: true,
          solution: "⚠️ تنبيه: يرجى إضافة GEMINI_API_KEY في إعدادات المنصة لتفعيل الحل الذكي المباشر."
        },
        { status: 200 }
      );
    }

    const ai = new GoogleGenAI();
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
      config: { responseMimeType: "application/json" }
    });

    const parsedData = JSON.parse(response.text || "{}");

    return NextResponse.json({
      success: true,
      problem,
      data: parsedData,
      raw: response.text
    });

  } catch (error) {
    console.error("Math Solver Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "حدث خطأ أثناء معالجة وحل المسألة الرياضية.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// مسار GET للتحقق من صحة المسار (Health Check)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "MathMentor Math Solver Engine",
    geminiConfigured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
  });
}
