/**
 * Owner's Gemini voice endpoint (formerly POST /api/agent/whatsapp-voice).
 * The Agent Hub pipeline (allow-listed instructor phone, approvals, Whisper/Gemini) now owns
 * /api/agent/whatsapp-voice; this route keeps the direct "voice note → Gemini → code-evolution"
 * flow, with commits limited to a staff session or AGENT_WEBHOOK_SECRET.
 * Hardening r2: it used to be an open Gemini proxy (anyone could spend the quota). Now callers need
 * an AI-access session, staff, or the agent secret; audio is size-capped; GET is not served; errors
 * no longer echo provider messages.
 */
import { NextRequest, NextResponse } from "next/server";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";
import { canRunCodeEvolution, CODE_EVOLUTION_LOCKED_AR, looksLikeCodeChange } from "@/lib/agent/codeEvolutionGate";
import { authorizeAiCaller } from "@/lib/security/aiCaller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

function tooLarge() {
  return NextResponse.json({ reply: "الملف الصوتي كبير جداً." }, { status: 413 });
}

/** Nothing to read here: no config / env / phone details on GET. */
export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}

type VoiceJsonBody = { audio?: unknown; base64?: unknown; data?: unknown; mimeType?: unknown };

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value) return value;
  }
  return "";
}

export async function POST(req: NextRequest) {
  const caller = await authorizeAiCaller(req);
  if (!caller.ok) return caller.response;
  try {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 64 * 1024) return tooLarge();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: "خدمة تفريغ الصوت غير مفعّلة حالياً." }, { status: 503 });
    }

    let base64Audio = "";
    let mimeType = "audio/ogg";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("audio") || formData.get("file") || formData.get("voice");
      if (file instanceof Blob) {
        if (file.size > MAX_AUDIO_BYTES) return tooLarge();
        const buffer = Buffer.from(await file.arrayBuffer());
        base64Audio = buffer.toString("base64");
        mimeType = file.type || "audio/ogg";
      }
    } else if (contentType.includes("application/json")) {
      const json = (await req.json().catch(() => ({}))) as VoiceJsonBody;
      base64Audio = firstString(json.audio, json.base64, json.data);
      const hinted = firstString(json.mimeType);
      if (hinted) mimeType = hinted;
      if (base64Audio.length > Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 8) return tooLarge();
    } else {
      const buffer = Buffer.from(await req.arrayBuffer());
      if (buffer.length > MAX_AUDIO_BYTES) return tooLarge();
      if (buffer.length > 0) {
        base64Audio = buffer.toString("base64");
      }
    }

    if (!base64Audio) {
      return NextResponse.json({ reply: "تعذر استلام الملف الصوتي، يرجى إعادة المحاولة." }, { status: 400 });
    }

    // استدعاء Gemini مباشرة لتفريغ الصوت وفهم محتواه
    const promptText = `أنت محمد، مساعد فريق MathMentor (العلامة: منذر حداره · MathMentor). لا تنتحل شخصية أي إنسان.
قم بتفريغ المقطع الصوتي بدقة تامة. 
إذا كان التسجيل يتضمن أمراً لتعديل أو تطوير المنصة (مثل: عدل، غير، أضف، كود، صفحة)، لخص التعديل البرمجي المطلوب بوضوح.
إذا كان استفساراً عاماً أو دراسياً، أجب عليه باحترافية واختصار، ووقّع باسم «محمد».`;

    const geminiRes = await fetch(
      // gemini-1.5-flash is retired (404); key goes in a header, never the URL.
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest")}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
      },
    );

    const data = (await geminiRes.json()) as GeminiResponse;
    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!transcript) {
      return NextResponse.json({ reply: "تعذر تفريغ الصوت، يرجى المحاولة بصوت أوضح." });
    }

    // التحقق هل يحتوي التفريغ على طلب برمجي
    if (looksLikeCodeChange(transcript)) {
      if (!(await canRunCodeEvolution(req))) {
        return NextResponse.json(
          { reply: `${CODE_EVOLUTION_LOCKED_AR}\n\n"${transcript}"`, source: "gemini-voice", transcript, locked: true },
          { status: 403 },
        );
      }
      // Path C is disabled: never claims success, never commits.
      const result = await executeCodeEvolution({ prompt: transcript });
      return NextResponse.json({
        reply: `${result.messageAr}\n\n"${transcript}"`,
        source: "code-evolution-disabled",
        disabled: true,
        success: false,
        transcript,
      });
    }

    return NextResponse.json({ reply: transcript, source: "gemini-voice" });
  } catch (error) {
    console.error("Voice Route Error:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ reply: "تعذر تفريغ الصوت، حاول مجدداً بعد قليل." }, { status: 500 });
  }
}
