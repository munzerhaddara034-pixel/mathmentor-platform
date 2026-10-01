import { NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";
import { canRunCodeEvolution, looksLikeCodeChange } from "@/lib/agent/codeEvolutionGate";
import { generate, type GeminiPart } from "@/lib/solver/gemini/client";

export const dynamic = "force-dynamic";

type BotJsonBody = {
  message?: unknown;
  text?: unknown;
  query?: unknown;
  audio?: unknown;
  base64?: unknown;
  voice?: unknown;
  mimeType?: unknown;
  audioUrl?: unknown;
  mediaUrl?: unknown;
  url?: unknown;
};

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/** Plain-text Gemini call over the shared fast model list (no retired model ids). */
async function geminiReply(parts: GeminiPart[]): Promise<string> {
  const result = await generate({
    parts,
    tier: "fast",
    thinking: "low",
    maxOutputTokens: 2048,
    deadlineMs: 30_000,
    callTimeoutMs: 25_000,
    json: false,
  });
  return result.text.trim();
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let base64Audio = "";
    let mimeType = "audio/ogg";

    // 1. استخراج البيانات سواء كانت JSON أو FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = firstString(formData.get("message"), formData.get("text"));
      const audioFile = formData.get("audio") || formData.get("file") || formData.get("voice");
      if (audioFile instanceof Blob) {
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        base64Audio = buffer.toString("base64");
        mimeType = audioFile.type || "audio/ogg";
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as BotJsonBody;
      message = firstString(body.message, body.text, body.query);

      // استخراج الصوت إذا وجد بصيغة base64 أو رابط
      const inlineAudio = firstString(body.audio, body.base64, body.voice);
      const mediaUrl = firstString(body.audioUrl, body.mediaUrl, body.url);
      if (inlineAudio) {
        base64Audio = inlineAudio;
        const hinted = firstString(body.mimeType);
        if (hinted) mimeType = hinted;
      } else if (mediaUrl) {
        // تنزيل ملف الصوت في حال إرساله كرابط من وسيط واتساب
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
        message = await geminiReply([
          {
            text: "أنت المساعد الذكي محمد للأستاذ منذر حداره في منصة MathMentor. استمع للتسجيل الصوتي بدقة وفرّغه نصياً كما قيل تماماً دون أي زيادات أو مقدمات.",
          },
          { inline_data: { mime_type: mimeType.split(";")[0], data: base64Audio } },
        ]);
      } catch (err) {
        console.error("Gemini Transcription Error:", err);
      }
    }

    if (!message) {
      return NextResponse.json({ reply: "تعذر قراءة الرسالة أو تفريغ المقطع الصوتي، يرجى إعادة المحاولة." }, { status: 400 });
    }

    // 3. التحقق من الأوامر الهندسية والبرمجية (فقط لجلسة الأستاذ أو سر الوكيل — لا لزوار الدردشة)
    if (looksLikeCodeChange(message, ["عنوان"])) {
      if (await canRunCodeEvolution(request)) {
        const result = await executeCodeEvolution({ prompt: message });
        const reply = `🤝 أهلاً بك يا أستاذ منذر!\nأنجز المهندس التعديل بنجاح 🚀\n• نص الأمر المستلم: "${message}"\n• الملف المحدّث: ${result.fileUpdated}\n• التغيير: ${result.commitMessage}`;
        return NextResponse.json({ reply, source: "code-evolution-agent", transcript: message });
      }
      console.info("bot: code-change wording from an unauthenticated caller — answered as chat, no commit.");
    }

    // 4. استجابة الذكاء الاصطناعي العامة في حال لم يكن طلباً برمجياً
    if (!apiKey) {
      return NextResponse.json({
        reply: "🤝 محمد: أهلاً بك! تم استلام رسالتك، ومفتاح الذكاء الاصطناعي قيد التفعيل.",
        source: "system",
      });
    }

    let aiText = "";
    try {
      aiText = await geminiReply([
        {
          text: `أنت محمد، السكرتير الذكي والمساعد التنفيذي للأستاذ منذر حداره لمنصة MathMentor للرياضيات. أجب باحترافية واختصار وود:\n\nرسالة الأستاذ أو المستخدم: "${message}"`,
        },
      ]);
    } catch (err) {
      console.error("Gemini chat error:", err instanceof Error ? err.message : "unknown");
    }
    const finalReply = aiText || "🤝 أهلاً بك يا أستاذ منذر، استلمت رسالتك وجارٍ متابعتها.";

    return NextResponse.json({ reply: finalReply, source: "gemini" });
  } catch (error) {
    console.error("Bot Route Error:", error);
    return NextResponse.json({ reply: "خطأ في معالجة الطلب، حاول مجدداً بعد قليل." }, { status: 500 });
  }
}
