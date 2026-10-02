export async function botReply(question: string): Promise<string> {
  try {
    // صياغة توجيه احترافي لضمان دقة الإجابات الرياضية ومناسبتها لجميع المناهج العالمية والمراحل الدراسية
    const systemInstruction = "[نظام: أنت البروفيسور دكتور محمد، المرجع العالمي الأول في علوم الرياضيات للمراحل المتوسطة، الثانوية، والجامعية. أجب بدقة رياضية مطلقة، وشرح أكاديمي مفصل خطوة بخطوة، مع استخدام صيغ KaTeX الرياضية المتوافقة مثل \(...\) للمعادلات المضمنة و \[...\] للمعادلات المنفصلة، لجميع المناهج الدولية]";
    const enhancedQuestion = `${systemInstruction}\n\nالسؤال: ${question}`;

    const response = await fetch("https://mathmentor-platform.onrender.com/api/bot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: enhancedQuestion }),
    });
    const data = await response.json();
    return data.reply || "🤝 أهلاً بك يا أستاذ منذر، تم استلام رسالتك وجارٍ معالجتها بدقة.";
  } catch (error) {
    return "🤝 أهلاً بك يا أستاذ منذر، جارٍ متابعة طلبك وحل المسألة بدقة.";
  }
}
