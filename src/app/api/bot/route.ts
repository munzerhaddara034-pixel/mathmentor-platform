import { NextResponse } from "next/server";
import { assistantSystemPrompt, botReply, knowledgeBase } from "@/lib/bot";

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string };
  const message = body.message ?? "";
  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: `${assistantSystemPrompt}\n\nقاعدة المعارف:\n${knowledgeBase()}` },
            { role: "user", content: message },
          ],
        }),
      });
      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return NextResponse.json({ reply, source: "openai" });
    } catch {
      /* fall back to local RAG answers */
    }
  }
  return NextResponse.json({ reply: botReply(message), source: "local" });
}
