export async function botReply(question: string): Promise<string> {
  try {
    const response = await fetch("https://mathmentor-platform.onrender.com/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });
    const data = await response.json();
    return data.reply || "🤝 أهلاً بك يا أستاذ منذر، تم استلام رسالتك.";
  } catch (error) {
    return "🤝 أهلاً بك يا أستاذ منذر، جارٍ متابعة طلبك.";
  }
}
