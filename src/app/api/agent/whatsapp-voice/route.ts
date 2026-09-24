import { NextRequest, NextResponse } from "next/server";
import { generateCodeChange, executeAndDeployCode, CodeEvolutionPlan } from "@/lib/agent/codeEvolutionAgent";

// ذاكرة مؤقتة لآخر خطة تعديل تنتظر الاعتماد
let pendingPlan: CodeEvolutionPlan | null = null;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messageText = body.text || body.transcript || body.message || "";

    if (!messageText) {
      return NextResponse.json({ reply: "لم أتمكن من استلام الأمر بشكل واضح." }, { status: 400 });
    }

    const command = messageText.trim();

    // 1. حالة اعتماد ونشر التعديل البرمجي
    if (/^(اعتمد|موافق|انشر|نفذ|approve)$/i.test(command)) {
      if (!pendingPlan) {
        return NextResponse.json({ reply: "لا يوجد أي تعديل برمجي معلّق بانتظار الاعتماد حالياً." });
      }

      const result = await executeAndDeployCode(pendingPlan);
      const executed = pendingPlan;
      pendingPlan = null; // تفريغ الخطة بعد التنفيذ

      if (result.ok) {
        return NextResponse.json({
          reply: `🚀 تم اعتماد التعديل ورفعه بنجاح إلى GitHub!\n` +
                 `📁 الملف: ${executed.targetFilePath}\n` +
                 `🔗 الرابط: ${result.commitUrl || "تم التحديث بنجاح"}`
        });
      } else {
        return NextResponse.json({
          reply: `⚠️ حدث خطأ أثناء النشر إلى GitHub: ${result.error}`
        });
      }
    }

    // 2. حالة طلب تطوير أو تعديل برمجي
    if (/طور|عدل|برمج|غير في الصفحة|code|develop|edit/i.test(command)) {
      // افتراضياً نعدل الصفحة الرئيسية أو يمكن تحديد ملف آخر
      const targetFile = "src/app/page.tsx";
      
      const plan = await generateCodeChange(command, targetFile);
      pendingPlan = plan; // حفظ الخطة بانتظار موافقتك

      return NextResponse.json({
        reply: `🛠️ تم إعداد التعديل البرمجي بنجاح:\n\n` +
               `📝 الشرح: ${plan.explanation}\n` +
               `📁 الملف المستهدف: ${plan.targetFilePath}\n\n` +
               `هل أعتمد النشر إلى GitHub لتحديث المنصة؟ أرسل كلمة (اعتمد) للتنفيذ فوراً.`
      });
    }

    // 3. باقي المهام العامة للسكرتير التنفيذي
    return NextResponse.json({
      reply: `مرحباً بك. تم استلام رسالتك: "${command}". كيف تحب أن أساعدك في منصة MathMentor اليوم؟`
    });

  } catch (error) {
    return NextResponse.json(
      { reply: "عذراً، حدث خطأ أثناء معالجة طلبك.", error: String(error) },
      { status: 500 }
    );
  }
}
