import { GoogleGenAI } from "@google/genai";
import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "munzerhaddara034-pixel";
const GITHUB_REPO = process.env.GITHUB_REPO || "mathmentor-platform";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "cursor/platform-shell-auth-dashboard-2f19";

export interface CodeEvolutionPlan {
  targetFilePath: string;
  explanation: string;
  proposedCode: string;
  commitMessage: string;
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

/**
 * محرك المهندس البرمجي:
 * يستقبل الأمر الهندسي، يحدد الملف المعني ويقرأ محتواه من GitHub،
 * ثم يولد التعديل المناسب، وينفذ الـ Commit مباشرة في الفرع المناسب.
 */
export async function executeCodeEvolution(params: {
  prompt: string;
  branch?: string;
}) {
  const branch = params.branch || GITHUB_BRANCH;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    // 1. تحديد الملف المطلوب تعديله وفهم التغييرات عبر نموذج Gemini المعتمد
    const plannerResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `أنت كبير مهندسي البرمجيات لمنصة MathMentor.
طلب التعديل من الأستاذ منذر: "${params.prompt}"

حدد بدقة:
1. ما هو المسار النسبي الدقيق للملف المطلوب تعديله (مثال: "src/app/page.tsx")؟
2. رسالة الـ Commit المناسبة باللغة الإنجليزية.

أجب بصيغة JSON فقط:
{
  "targetFilePath": string,
  "commitMessage": string
}`,
            },
          ],
        },
      ],
      config: { responseMimeType: "application/json" },
    });

    const plan = JSON.parse(plannerResponse.text || "{}");
    const targetFilePath = plan.targetFilePath || "src/app/page.tsx";
    const commitMessage = plan.commitMessage || `Auto update via AI: ${params.prompt}`;

    // 2. قراءة الكود الحالي للملف من مستودع GitHub
    let existingContent = "";
    let fileSha: string | undefined = undefined;

    try {
      const fileData = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: targetFilePath,
        ref: branch,
      });

      if (!Array.isArray(fileData.data) && "content" in fileData.data) {
        existingContent = Buffer.from(fileData.data.content, "base64").toString("utf-8");
        fileSha = fileData.data.sha;
      }
    } catch (readErr: any) {
      console.warn("File may not exist, creating new or proceeding:", readErr.message);
    }

    // 3. كتابة وتوليد الكود المحدّث كاملاً بالذكاء الاصطناعي
    const coderResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `أنت كبير مهندسي البرمجيات لمنصة MathMentor.
المطلوب تنفيذ التعديل التالي بدقة: "${params.prompt}"
مسار الملف: "${targetFilePath}"

محتوى الملف الحالي:
\`\`\`
${existingContent}
\`\`\`

قواعد صارمة:
- أعد كتابة كود الملف كاملاً وجاهزاً للتشغيل والإنتاج.
- لا تضع أي شروحات أو مقدمات خارج كود المصدر.
- أرجع فقط الكود الصافي النقي.`,
            },
          ],
        },
      ],
    });

    let newCode = coderResponse.text || existingContent;
    newCode = newCode.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();

    // 4. رفع الـ Commit المباشر إلى مستودع GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: targetFilePath,
      message: commitMessage,
      content: Buffer.from(newCode, "utf-8").toString("base64"),
      branch: branch,
      sha: fileSha,
    });

    return {
      success: true,
      fileUpdated: targetFilePath,
      commitMessage: commitMessage,
    };
  } catch (error: any) {
    console.error("Code Evolution Agent Execution Failed:", error);
    return {
      success: false,
      fileUpdated: "src/app/page.tsx",
      commitMessage: `تعذر إتمام التعديل برمجياً: ${error.message}`,
    };
  }
}
