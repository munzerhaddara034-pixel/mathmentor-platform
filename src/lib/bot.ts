export async function botReply(question: string): Promise<string> {
  try {
    const systemPrompt = "أنت البروفيسور الدكتور يوسف، خبير عالمي في الرياضيات لجميع المراحل الدراسية (المتوسطة، الثانوية، والجامعية) ولكافة المناهج العالمية. قدم إجابات دقيقة، مفصلة، ومدعومة بصيغ KaTeX الرياضية الشروحات الأكاديمية الواضحة.";
    const response = await fetch("https://mathmentor-platform.onrender.com/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, systemPrompt }),
    });
    const data = await response.json();
    return data.reply || "🤝 أهلاً بك يا أستاذ منذر، معك البروفيسور يوسف، تم استلام سؤالك الرياضي.";
  } catch (error) {
    return "🤝 أهلاً بك يا أستاذ منذر، معك البروفيسور يوسف، جارٍ متابعة طلبك الأكاديمي.";
  }
}
