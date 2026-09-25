import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { executeCodeEvolution } from "@/lib/agent/codeEvolutionAgent";

export const dynamic = "force-dynamic";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let transcript = "";

    // 1. استقبال المقطع الصوتي ومعالجته بذكاء
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const audioFile = formData.get("audio") as Blob | null;

      if (!audioFile) {
        return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
      }

      const buffer = Buffer.from(await audioFile.arrayBuffer());
      const base64Audio = buffer.toString("base64");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "أنت السكرتير الذكي 'محمد' والمساعد الهندسي لمنصة MathMentor. استمع إلى هذا المقطع الصوتي بدقة، واستخرج طلب المستخدم بوضوح وحدد ما إذا كان طلباً لتعديل الكود أو استفساراً عاماً.",
              },
              {
                inlineData: {
                  mimeType: audioFile.type || "audio/ogg",
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      });

      transcript = response.text || "";
    } else {
      const body = await req.json();
      transcript = body.text || body.transcript || body.message || "";
    }

    if (!transcript) {
      return NextResponse.json({ error: "لم يتم استلام أي نص أو تسجيل صوتي واضح" }, { status: 400 });
    }

    // 2. تحليل نية الأمر وتحديد هل يتطلب تدخلاً برمجياً من المهندس
    const decisionResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `النص التالي هو طلب من الأستاذ منذر: "${transcript}".
هل يتطلب هذا تعديلاً في الكود أو ملفات المنصة؟ 
إذا كان نعم، استخرج التعليمات الهندسية بدقة (ما هو الملف وما التعديل المطلوب). 
إذا كان لا، أجب بالرد المناسب بصفتك السكرتير محمد.
أجب بصيغة JSON حصراً:
{
  "isCodeTask": boolean,
  "instruction": string,
  "replyMessage": string
}`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(decisionResponse.text || "{}");

    // 3. التنفيذ البرمجي التلقائي عبر المهندس البرمجي
    let executionResult = null;
    if (parsed.isCodeTask && typeof executeCodeEvolution === "function") {
      executionResult = await executeCodeEvolution({
        prompt: parsed.instruction || transcript,
        branch: process.env.GITHUB_BRANCH || "cursor/platform-shell-auth-dashboard-2f19",
      });
    }

    return NextResponse.json({
      success: true,
      sender: "محمد، سكرتير الأستاذ منذر / المهندس البرمجي",
      transcript,
      actionTaken: parsed.isCodeTask ? "تم تنفيذ التعديل البرمجي بنجاح" : "تم الرد على الاستفسار",
      details: executionResult || parsed.replyMessage,
    });
  } catch (error: any) {
    console.error("Agent error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
