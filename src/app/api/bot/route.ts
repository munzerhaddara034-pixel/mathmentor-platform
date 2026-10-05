import { NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";
import { canRunCodeEvolution, looksLikeCodeChange } from "@/lib/agent/codeEvolutionGate";
import { generate, type GeminiPart } from "@/lib/solver/gemini/client";
import { TUTOR_PERSONA_EN } from "@/lib/tutor/persona";
import { authorizeAiCaller } from "@/lib/security/aiCaller";
import { BlockedFetchError, safeFetchBytes } from "@/lib/security/safeFetch";

export const dynamic = "force-dynamic";

/** Inline / fetched audio cap (WhatsApp voice notes are far smaller). */
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_MESSAGE_CHARS = 4000;

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
  /** Site language of the chat widget (en default); only picks the canned replies. */
  locale?: unknown;
};

type ReplyLocale = "en" | "ar" | "fr";

/** Canned widget replies, in the visitor's site language. Persona: Dr. Mohamed · Munzer's assistant, disclosed as an AI tutor. */
const CANNED: Record<ReplyLocale, { noKey: string; failed: string }> = {
  en: {
    noKey: "Hi! I'm Dr. Mohamed · Munzer's assistant, MathMentor's AI tutor. AI replies aren't switched on yet — please try again soon.",
    failed: "I got your message but can't reply right now. Please try again shortly.",
  },
  ar: {
    noKey: "أهلاً بك! أنا الدكتور محمد · مساعد منذر، المعلّم بالذكاء الاصطناعي في MathMentor. الردود الذكية غير مفعّلة بعد — جرّب مجدداً قريباً.",
    failed: "وصلتني رسالتك لكن لا أستطيع الرد الآن. جرّب مجدداً بعد قليل.",
  },
  fr: {
    noKey: "Bonjour ! Je suis Dr. Mohamed · Munzer's assistant, le tuteur IA de MathMentor. Les réponses IA ne sont pas encore activées — réessayez bientôt.",
    failed: "J’ai bien reçu votre message, mais je ne peux pas répondre pour le moment. Réessayez dans un instant.",
  },
};

function replyLocale(value: unknown): ReplyLocale {
  return value === "ar" || value === "fr" ? value : "en";
}

/** Student/visitor chat prompt: the AI-tutor persona plus the widget's scope. */
function chatPrompt(message: string): string {
  return `${TUTOR_PERSONA_EN}
In this chat widget you also answer short questions about MathMentor (lessons, exercises, subscriptions, live sessions with the real teacher). Be professional, brief and warm. Never invent prices, dates or promises; point to the relevant page or to Prof. Munzer Haddara's WhatsApp instead.
Reply in the language the message is written in (English if unclear).

Message: """${message}"""`;
}

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
  // Gemini costs money and the widget used to be open to anyone: signed-in AI users, staff or the
  // agent secret only. Logged-out visitors get a 401 with a sign-in hint (ChatWidget shows it).
  const caller = await authorizeAiCaller(request);
  if (!caller.ok) return caller.response;
  try {
    const contentType = request.headers.get("content-type") || "";
    let message = "";
    let base64Audio = "";
    let mimeType = "audio/ogg";
    let locale: ReplyLocale = "en";

    // 1. استخراج البيانات سواء كانت JSON أو FormData
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      message = firstString(formData.get("message"), formData.get("text"));
      const audioFile = formData.get("audio") || formData.get("file") || formData.get("voice");
      if (audioFile instanceof Blob) {
        if (audioFile.size > MAX_AUDIO_BYTES) {
          return NextResponse.json({ reply: "الملف الصوتي كبير جداً." }, { status: 413 });
        }
        const buffer = Buffer.from(await audioFile.arrayBuffer());
        base64Audio = buffer.toString("base64");
        mimeType = audioFile.type || "audio/ogg";
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as BotJsonBody;
      message = firstString(body.message, body.text, body.query);
      locale = replyLocale(body.locale);

      // استخراج الصوت إذا وجد بصيغة base64 أو رابط
      const inlineAudio = firstString(body.audio, body.base64, body.voice);
      const mediaUrl = firstString(body.audioUrl, body.mediaUrl, body.url);
      if (inlineAudio) {
        if (inlineAudio.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 8) {
          return NextResponse.json({ reply: "الملف الصوتي كبير جداً." }, { status: 413 });
        }
        base64Audio = inlineAudio;
        const hinted = firstString(body.mimeType);
        if (hinted) mimeType = hinted;
      } else if (mediaUrl) {
        // تنزيل ملف الصوت في حال إرساله كرابط من وسيط واتساب
        // SSRF guard: https + allow-listed provider/platform hosts only, public IPs only, size-capped.
        try {
          const fetched = await safeFetchBytes(mediaUrl, { maxBytes: MAX_AUDIO_BYTES });
          base64Audio = fetched.bytes.toString("base64");
          mimeType = fetched.contentType || "audio/ogg";
        } catch (fetchErr) {
          if (fetchErr instanceof BlockedFetchError) {
            console.warn(`bot: media URL refused (${fetchErr.reason})`);
            return NextResponse.json({ reply: "رابط الوسائط غير مسموح." , error: "media_url_not_allowed" }, { status: 400 });
          }
          console.error("Failed to fetch media url:", fetchErr instanceof Error ? fetchErr.message : "unknown");
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
            text: "You are MathMentor's speech-to-text transcriber. Listen carefully and transcribe the recording exactly as spoken (any language, including Lebanese Arabic), with no additions or preamble.",
          },
          { inline_data: { mime_type: mimeType.split(";")[0], data: base64Audio } },
        ]);
      } catch (err) {
        console.error("Gemini Transcription Error:", err);
      }
    }

    message = message.slice(0, MAX_MESSAGE_CHARS);
    if (!message) {
      return NextResponse.json({ reply: "تعذر قراءة الرسالة أو تفريغ المقطع الصوتي، يرجى إعادة المحاولة." }, { status: 400 });
    }

    // 3. أوامر تعديل الكود من الدردشة (Path C) معطّلة كلياً: للطاقم نرد برسالة «معطّل» صريحة، ولا نَدّعي النجاح أبداً.
    if (looksLikeCodeChange(message, ["عنوان"])) {
      if (await canRunCodeEvolution(request)) {
        const result = await executeCodeEvolution({ prompt: message });
        return NextResponse.json({
          reply: result.messageAr,
          source: "code-evolution-disabled",
          disabled: true,
          success: false,
          transcript: message,
        });
      }
      console.info("bot: code-change wording from an unauthenticated caller — answered as chat, no commit.");
    }

    // 4. استجابة الذكاء الاصطناعي العامة في حال لم يكن طلباً برمجياً
    if (!apiKey) {
      return NextResponse.json({
        reply: CANNED[locale].noKey,
        source: "system",
      });
    }

    let aiText = "";
    try {
      aiText = await geminiReply([{ text: chatPrompt(message) }]);
    } catch (err) {
      console.error("Gemini chat error:", err instanceof Error ? err.message : "unknown");
    }
    const finalReply = aiText || CANNED[locale].failed;

    return NextResponse.json({ reply: finalReply, source: "gemini" });
  } catch (error) {
    console.error("Bot Route Error:", error);
    return NextResponse.json({ reply: "خطأ في معالجة الطلب، حاول مجدداً بعد قليل." }, { status: 500 });
  }
}
