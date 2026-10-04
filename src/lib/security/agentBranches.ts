/**
 * Where platform agents may write code. Dependency-free (unit-tested).
 * Agents (Hamza in /admin/team, Agent Hub / WhatsApp code evolution, the legacy code-evolution
 * engine) may only ever commit to a short-lived `feat/*`-style branch. The live Render branch,
 * main/master and the old live branch are never valid targets — not even with a typed confirmation.
 */
export const NEVER_AGENT_BRANCHES = ["main", "master", "agent-hub-latest", "cursor/platform-shell-auth-dashboard-2f19"] as const;

/** Allowed agent branch prefixes ("feat/*" style). */
export const AGENT_BRANCH_PREFIXES = ["feat/", "fix/", "chore/", "docs/"] as const;

const BRANCH_RE = /^(?!.*\.\.)(?!.*\/\/)(?!.*@\{)[A-Za-z0-9][A-Za-z0-9._/-]{1,80}$/;

export type AgentBranchCheck = { ok: true; branch: string } | { ok: false; branch: string; reason: string; reasonAr: string };

export function agentCommitBranchCheck(rawBranch: string | undefined | null, options?: { liveBranch?: string }): AgentBranchCheck {
  const branch = (rawBranch || "").trim();
  const live = options?.liveBranch?.trim();
  const blocked = new Set<string>([...NEVER_AGENT_BRANCHES, ...(live ? [live] : [])]);
  if (!branch || !BRANCH_RE.test(branch) || branch.endsWith("/") || branch.endsWith(".lock")) {
    return { ok: false, branch, reason: "Invalid branch name.", reasonAr: "اسم الفرع غير صالح." };
  }
  if (blocked.has(branch) || blocked.has(branch.replace(/^refs\/heads\//, ""))) {
    return {
      ok: false,
      branch,
      reason: `Agents may never write to ${branch} (live / protected branch).`,
      reasonAr: `ممنوع على الوكلاء الكتابة على ${branch} (فرع حيّ أو محمي).`,
    };
  }
  if (!AGENT_BRANCH_PREFIXES.some((prefix) => branch.startsWith(prefix) && branch.length > prefix.length)) {
    return {
      ok: false,
      branch,
      reason: `Agent branches must start with ${AGENT_BRANCH_PREFIXES.join(", ")}.`,
      reasonAr: `فرع الوكيل لازم يبدأ بـ ${AGENT_BRANCH_PREFIXES.join(" أو ")}.`,
    };
  }
  return { ok: true, branch };
}

/**
 * Agent Hub / WhatsApp code evolution ("Path B") may still create and list proposals, but nothing
 * is committed to GitHub. Hard-coded on purpose (not an env flag): re-enabling needs a code change.
 */
export const AGENT_HUB_CODE_COMMITS_ENABLED = false as boolean;

/** Chat-widget / voice "Path C" (executeCodeEvolution) is switched off entirely. */
export const CHAT_CODE_EVOLUTION_ENABLED = false as boolean;

export const CODE_COMMITS_DISABLED_AR =
  "⛔ إنشاء Commit من Agent Hub / واتساب معطّل حالياً لأسباب أمنية. المقترح محفوظ للمراجعة فقط ولم يُكتب أي شيء على GitHub. للتعديلات البرمجية استخدم حمزة في /admin/team (فرع feat/ فقط).";

export const CODE_EVOLUTION_DISABLED_AR =
  "⛔ تعديل كود المنصة من الدردشة أو الرسائل الصوتية معطّل حالياً. لم يُنفَّذ أي تعديل ولم يُنشأ أي Commit. للتعديلات البرمجية استخدم حمزة في /admin/team (فرع feat/ مع موافقة بشرية).";

export const CODE_EVOLUTION_DISABLED_EN =
  "Code changes from chat or voice are disabled. Nothing was changed and no commit was made. Use Hamza in /admin/team (feat/* branch, human approval).";
