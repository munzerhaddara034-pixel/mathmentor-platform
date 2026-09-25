import { NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let base64Audio = "";
    let mimeType = "audio/ogg";

    // 1. استخراج البيانات سواء كانت JSON أو FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = (formData.get("message") || formData.get("text") || "") as string;
      const audioFile = (formData.get("audio") || formData.get("file") || formData.get("voice")) as Blob | null;
      if (audioFile) {
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        base64Audio = buffer.toString("base64");
        mimeType = audioFile.type || "audio/ogg";
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as Record<string, any>;
      message = body.message || body.text || body.query || "";

      // استخراج الصوت إذا وجد بصيغة base64 أو رابط
      if (body.audio || body.base64 || body.voice) {
        base64Audio = body.audio || body.base64 || body.voice;
        if (body.mimeType) mimeType = body.mimeType;
      } else if (body.audioUrl || body.mediaUrl || body.url) {
        // تنزيل ملف الصوت في حال إرساله كرابط من وسيط واتساب
        const mediaUrl = body.audioUrl || body.mediaUrl || body.url;
        try {
          const fetchRes = await fetch(mediaUrl);
          const arrayBuffer = await fetchRes.arrayBuffer();
          base64Audio = Buffer.from(arrayBuffer).toString("base64");
          mimeType = fetchRes.headers.get("content-type") || "audio/ogg";
        } catch (fetchErr) {
          console.error("Failed to fetch media url:", fetchErr);
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 2. إذا كانت الرسالة صوتية ولم يأتِ نص، نقوم بتفريغ الصوت عبر Gemini
    if (!message && base64Audio) {
      if (!apiKey) {
        return NextResponse.json({ reply: "مفتاح GEMINI_API_KEY غير مضبوط في خادم Render." });
      }

      try {
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
                      text: "أنت المساعد الذكي محمد للأستاذ منذر حداره في منصة MathMentor. استمع للتسجيل الصوتي بدقة وفرّغه نصياً كما قيل تماماً دون أي زيادات أو مقدمات.",
                    },
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

        const geminiData = await geminiRes.json();
        message = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      } catch (err: any) {
        console.error("Gemini Transcription Error:", err);
      }
    }

    if (!message) {
      return NextResponse.json({ reply: "تعذر قراءة الرسالة أو تفريغ المقطع الصوتي، يرجى إعادة المحاولة." }, { status: 400 });
    }

    // 3. التحقق من الأوامر الهندسية والبرمجية
    const isCodeChange =
      message.includes("عدل") ||
      message.includes("تعديل") ||
      message.includes("غير") ||
      message.includes("صفحة") ||
      message.includes("عنوان") ||
      message.includes("أضف") ||
      message.includes("كود");

    if (isCodeChange) {
      const result = await executeCodeEvolution({ prompt: message });
      const reply = `🤝 أهلاً بك يا أستاذ منذر!\nأنجز المهندس التعديل بنجاح 🚀\n• نص الأمر المستلم: "${message}"\n• الملف المحدّث: ${result.fileUpdated}\n• التغيير: ${result.commitMessage}`;
      return NextResponse.json({ reply, source: "code-evolution-agent", transcript: message });
    }

    // 4. استجابة الذكاء الاصطناعي العامة في حال لم يكن طلباً برمجياً
    if (!apiKey) {
      return NextResponse.json({
        reply: "🤝 محمد: أهلاً بك! تم استلام رسالتك، ومفتاح الذكاء الاصطناعي قيد التفعيل.",
        source: "system",
      });
    }

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `أنت محمد، السكرتير الذكي والمساعد التنفيذي للأستاذ منذر حداره لمنصة MathMentor للرياضيات. أجب باحترافية واختصار وود:\n\nرسالة الأستاذ أو المستخدم: "${message}"`,
                },
              ],
            },
          ],
        }),
      }
    );

    const aiData = await aiRes.json();
    const finalReply =
      aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "🤝 أهلاً بك يا أستاذ منذر، استلمت رسالتك وجارٍ متابعتها.";

    return NextResponse.json({ reply: finalReply, source: "gemini" });
  } catch (error: any) {
    console.error("Bot Route Error:", error);
    return NextResponse.json({ reply: `خطأ في معالجة الطلب: ${error.message}` }, { status: 500 });
  }
}
