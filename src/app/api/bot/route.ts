import { NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;
    
    // استخراج الرسالة سواء أرسلت كمفتاح message أو text أو query
    const message = body.message || body.text || body.query || "";

    if (!message) {
      return NextResponse.json({ reply: "لم يتم استلام أي نص." }, { status: 400 });
    }

    // التحقق من الأوامر الهندسية
    const isCodeChange =
      message.includes("عدل") ||
      message.includes("تعديل") ||
      message.includes("غير") ||
      message.includes("صفحة") ||
      message.includes("عنوان") ||
      message.includes("كود");

    if (isCodeChange) {
      const result = await executeCodeEvolution({ prompt: message });
      const reply = `🤝 محمد، سكرتير الأستاذ منذر حداره / MathMentor\n\nأنجز المهندس البرمجي التعديل بنجاح! 🚀\n• الملف المحدّث: ${result.fileUpdated}\n• التغيير: ${result.commitMessage}\n• الحالة: تم حفظ الـ Commit وسيقوم Render بإعادة النشر.\n— الأستاذ منذر حداره`;
      return NextResponse.json({ reply, source: "code-evolution-agent" });
    }

    // استدعاء Gemini REST API المباشر بدون الاعتماد على أي مكتبة قد تفشل في البناء
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: "🤝 محمد: أهلاً بك! تم استلام رسالتك، ومفتاح الذكاء الاصطناعي قيد التفعيل.",
        source: "system"
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `أنت محمد، المساعد الشخصي والسكرتير للأستاذ منذر حداره في منصة MathMentor التعليمية. رد باحترافية وود واختصار باسم الأستاذ منذر حداره على رسالة المستخدم: "${message}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "تم استلام رسالتكم بنجاح.";

    return NextResponse.json({ reply, source: "gemini" });
  } catch (error: any) {
    console.error("Bot Route Error:", error);
    return NextResponse.json(
      { reply: `تعذر إكمال المهمة: ${error.message || "حدث خطأ غير متوقع"}` },
      { status: 500 }
    );
  }
}
