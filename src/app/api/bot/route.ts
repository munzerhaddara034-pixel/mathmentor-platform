import { NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message ?? "";

    if (!message) {
      return NextResponse.json({ reply: "لم يتم استلام أي نص." }, { status: 400 });
    }

    // التحقق هل الرسالة عبارة عن طلب تعديل برمجي أو أمر هندسي
    const isCodeChange =
      message.includes("عدل") ||
      message.includes("تعديل") ||
      message.includes("غير") ||
      message.includes("صفحة") ||
      message.includes("عنوان") ||
      message.includes("كود");

    if (isCodeChange) {
      const result = await executeCodeEvolution({ prompt: message });
      const reply = `🤝 محمد، سكرتير الأستاذ منذر حداره / MathMentor\n\nأنجز المهندس البرمجي التعديل بنجاح! 🚀\n• الملف المحدّث: ${result.fileUpdated}\n• التغيير: ${result.commitMessage}\n• الحالة: تم إرسال الـ Commit وسيقوم Render بإعادة النشر التلقائي الآن.\n— الأستاذ منذر حداره`;
      return NextResponse.json({ reply, source: "code-evolution-agent" });
    }

    // الرد الذكي المعتاد عبر Gemini في حال كانت محادثة عادية
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `أنت محمد، المساعد الشخصي والسكرتير للأستاذ منذر حداره في منصة MathMentor التعليمية.
رد باحترافية، وود، واختصار باسم الأستاذ منذر حداره.
رسالة المستخدم: "${message}"`,
            },
          ],
        },
      ],
    });

    const reply = response.text || "تم استلام رسالتكم بنجاح.";
    return NextResponse.json({ reply, source: "gemini" });
  } catch (error: any) {
    console.error("Bot Route Error:", error);
    return NextResponse.json(
      {
        reply: `تعذر إكمال المهمة: ${error.message || "حدث خطأ غير متوقع"}`,
      },
      { status: 500 }
    );
  }
}
