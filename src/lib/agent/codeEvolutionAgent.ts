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

// 1. توليد التعديل البرمجي عبر الذكاء الاصطناعي
export async function generateCodeChange(userVoiceInstruction: string, targetFilePath: string): Promise<CodeEvolutionPlan> {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  
  let existingContent = "";
  try {
    const fileRes = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: targetFilePath,
      ref: GITHUB_BRANCH,
    });
    if (!Array.isArray(fileRes.data) && "content" in fileRes.data) {
      existingContent = Buffer.from(fileRes.data.content, "base64").toString("utf-8");
    }
  } catch {
    existingContent = "// New file";
  }

  const ai = new GoogleGenAI();
  const prompt = `
أنت مهندس برمجيات ذكي ومطور لمنصة MathMentor.
المطلوب تنفيذ التعديل التالي: "${userVoiceInstruction}"
الملف المستهدف: ${targetFilePath}
المحتوى الحالي:
\`\`\`typescript
${existingContent}
\`\`\`

اكتب الكود الجديد بالكامل بدقة. أعد النتيجة بصيغة JSON فقط:
{
  "targetFilePath": "${targetFilePath}",
  "explanation": "شرح سريع باللغة العربية لما تم تعديله",
  "proposedCode": "الكود الكامل للملف بعد التعديل والتصحيح دون اختصار",
  "commitMessage": "وصف الـ commit بالإنجليزية"
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  return JSON.parse(response.text || "{}") as CodeEvolutionPlan;
}

// 2. نشر الكود إلى GitHub فور موافقتك عبر واتساب
export async function executeAndDeployCode(plan: CodeEvolutionPlan): Promise<{ ok: boolean; commitUrl?: string; error?: string }> {
  if (!GITHUB_TOKEN) return { ok: false, error: "GITHUB_TOKEN غير موجود" };

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    let sha: string | undefined;
    try {
      const current = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: plan.targetFilePath,
        ref: GITHUB_BRANCH,
      });
      if (!Array.isArray(current.data) && "sha" in current.data) {
        sha = current.data.sha;
      }
    } catch {}

    const res = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: plan.targetFilePath,
      message: `⚡ [Autonomous Dev]: ${plan.commitMessage}`,
      content: Buffer.from(plan.proposedCode).toString("base64"),
      branch: GITHUB_BRANCH,
      sha,
    });

    return { ok: true, commitUrl: res.data.commit.html_url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "فشل النشر إلى GitHub" };
  }
}
