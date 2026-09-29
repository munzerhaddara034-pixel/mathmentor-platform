/**
 * Direct GitHub file commit for agent code-evolution (after instructor approval).
 * Never call without ApprovalItem state APPROVED/DEPLOYED path.
 * Brand: Prof. Munzer Haddara / الأستاذ منذر حداره
 */
import { Octokit } from "@octokit/rest";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
/** Default repo name when env empty — owner still required. */
const GITHUB_REPO = process.env.GITHUB_REPO || "mathmentor-platform";
const GITHUB_OWNER = process.env.GITHUB_OWNER || "";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

export interface CodeChangeRequest {
  filePath: string;
  commitMessage: string;
  newContent: string;
}

export function githubCommitEnvReady(): boolean {
  return Boolean(GITHUB_TOKEN.trim() && GITHUB_OWNER.trim());
}

export function githubCommitConfig(): {
  owner: string;
  repo: string;
  branch: string;
  tokenPresent: boolean;
} {
  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    tokenPresent: Boolean(GITHUB_TOKEN.trim()),
  };
}

export async function commitCodeDirectly(
  req: CodeChangeRequest,
): Promise<{ ok: boolean; commitUrl?: string; error?: string }> {
  if (!GITHUB_TOKEN || !GITHUB_OWNER) {
    return {
      ok: false,
      error: "متغيرات GitHub (GITHUB_TOKEN / GITHUB_OWNER) غير معرّفة في Netlify.",
    };
  }

  const filePath = req.filePath.trim().replace(/^\/+/, "");
  if (!filePath) {
    return { ok: false, error: "مسار الملف (filePath) فارغ." };
  }
  if (!req.newContent && req.newContent !== "") {
    return { ok: false, error: "محتوى الملف (newContent) مطلوب." };
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    let currentSha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
        ref: GITHUB_BRANCH,
      });

      if (!Array.isArray(existing.data) && "sha" in existing.data) {
        currentSha = existing.data.sha;
      }
    } catch {
      // File does not exist yet — createOrUpdate will create it.
    }

    const response = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `🤖 [Autonomous Agent]: ${req.commitMessage}`,
      content: Buffer.from(req.newContent, "utf8").toString("base64"),
      branch: GITHUB_BRANCH,
      sha: currentSha,
    });

    const commitUrl = response.data.commit.html_url ?? undefined;
    return { ok: true, commitUrl };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "فشل دفع التعديل إلى GitHub",
    };
  }
}
