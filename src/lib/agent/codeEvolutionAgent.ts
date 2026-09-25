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
 * يولد التعديل المناسب، ثم ينفذ الـ Commit مباشرة في الفرع.
 */
export async function executeCodeEvolution(params: {
  prompt: string;
  branch?: string;
}) {
  const branch = params.branch || GITHUB_BRANCH;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // 1. تحديد الملف المطلوب تعديله وفهم التغييرات عبر نموذج Gemini
  const plannerResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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

  // 2. قراءة الكود الحالي من مستودع GitHub
  let existingContent = "";
  let fileSha: string | undefined = undefined;

  try {
    const fileRes = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: targetFilePath,
      ref: branch,
    });

    if (!Array.isArray(fileRes.data) && "content" in fileRes.data) {
      existingContent = Buffer.from(fileRes.data.content, "base64").toString("utf-8");
      fileSha = fileRes.data.sha;
    }
  } catch (err: any) {
    console.warn(`File ${targetFilePath} not found, generating as a new file.`);
  }

  // 3. كتابة الكود البرمجي الجديد بالكامل مع الالتزام بقواعد Next.js و TypeScript
  const coderResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `أنت مهندس برمجيات محترف (Next.js 15, React, Tailwind CSS, TypeScript).
المطلوب تنفيذ التعديل التالي بدقة: "${params.prompt}"

مسار الملف: ${targetFilePath}

الكود الحالي للملف:
\`\`\`
${existingContent}
\`\`\`

أعد كتابة الملف كاملاً مع تطبيق التعديلات المطلوبة بدقة متناهية بدون أخطاء برمجية أو حقول مفقودة.
أرجع الكود الجديد فقط كنص خام دون علامات الماركداون (\`\`\`).`,
          },
        ],
      },
    ],
  });

  let updatedCode = coderResponse.text || "";
  updatedCode = updatedCode.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();

  if (!updatedCode) {
    throw new Error("لم يتمكن المهندس الذكي من إنتاج كود سليم.");
  }

  // 4. رفع الكود مباشرة وعمل Commit على GitHub
  const pushRes = await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: targetFilePath,
    message: commitMessage,
    content: Buffer.from(updatedCode, "utf-8").toString("base64"),
    branch: branch,
    sha: fileSha,
  });

  return {
    success: true,
    fileUpdated: targetFilePath,
    commitSha: pushRes.data.commit.sha,
    commitMessage,
    status: "تم تطبيق التعديل البرمجي بنجاح ورفعه إلى GitHub، وسيقوم Render بإعادة النشر التلقائي الآن.",
  };
}
