type BotRouteReply = { reply?: string };

/** Owner edit: the assistant reply now comes from the deployed `/api/bot` route (Gemini + code-evolution agent). */
export async function botReply(question: string): Promise<string> {
  try {
    const response = await fetch("https://mathmentor-platform.onrender.com/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });
    const data = (await response.json()) as BotRouteReply;
    return data.reply || "🤝 أهلاً بك يا أستاذ منذر، تم استلام رسالتك.";
  } catch {
    return "🤝 أهلاً بك يا أستاذ منذر، جارٍ متابعة طلبك.";
  }
}
