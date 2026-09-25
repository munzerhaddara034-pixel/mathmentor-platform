import { NextRequest, NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: "مفتاح GEMINI_API_KEY غير متوفر في الخادم." }, { status: 500 });
    }

    let base64Audio = "";
    let mimeType = "audio/ogg";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = (formData.get("audio") || formData.get("file") || formData.get("voice")) as Blob | null;
      if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        base64Audio = buffer.toString("base64");
        mimeType = file.type || "audio/ogg";
      }
    } else if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => ({}));
      base64Audio = json.audio || json.base64 || json.data || "";
      if (json.mimeType) mimeType = json.mimeType;
    } else {
      const buffer = Buffer.from(await req.arrayBuffer());
      if (buffer.length > 0) {
        base64Audio = buffer.toString("base64");
      }
    }

    if (!base64Audio) {
      return NextResponse.json({ reply: "تعذر استلام الملف الصوتي، يرجى إعادة المحاولة." }, { status: 400 });
    }

    // استدعاء Gemini مباشرة لتفريغ الصوت وفهم محتواه
    const promptText = `أنت محمد، المساعد الشخصي والسكرتير للأستاذ منذر حداره في منصة MathMentor.
قم بتفريغ المقطع الصوتي بدقة تامة. 
إذا كان التسجيل يتضمن أمراً لتعديل أو تطوير المنصة (مثل: عدل، غير، أضف، كود، صفحة)، لخص التعديل البرمجي المطلوب بوضوح.
إذا كان استفساراً عاماً أو دراسياً، أجب عليه باحترافية واختصار باسم الأستاذ منذر حداره.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: mimeType.split(";")[0],
                    data: base64Audio,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await geminiRes.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!transcript) {
      return NextResponse.json({ reply: "تعذر تفريغ الصوت، يرجى المحاولة بصوت أوضح." });
    }

    // التحقق هل يحتوي التفريغ على طلب برمجي
    const isCodeChange =
      transcript.includes("عدل") ||
      transcript.includes("تعديل") ||
      transcript.includes("غير") ||
      transcript.includes("صفحة") ||
      transcript.includes("أضف") ||
      transcript.includes("كود");

    if (isCodeChange) {
      const result = await executeCodeEvolution({ prompt: transcript });
      const reply = `🎙️ استلمت رسالتكم الصوتية يا أستاذ منذر:\n"${transcript}"\n\n🚀 أنجز المهندس البرمجي التعديل فوراً:\n• الملف المحدّث: ${result.fileUpdated}\n• التغيير: ${result.commitMessage}\n• الحالة: تم حفظ الـ Commit وتحديث المنصة بنجاح.`;
      return NextResponse.json({ reply, source: "code-evolution-agent", transcript });
    }

    return NextResponse.json({ reply: transcript, source: "gemini-voice" });
  } catch (error: any) {
    console.error("Voice Route Error:", error);
    return NextResponse.json({ reply: `تعذر تفريغ الصوت: ${error.message || "خطأ غير متوقع"}` }, { status: 500 });
  }
}
