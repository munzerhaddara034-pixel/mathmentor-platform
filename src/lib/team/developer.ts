/**
 * Branch / approval-text helpers for حمزة (developer agent). The agent itself is Hamza v2:
 * src/lib/hamza/agent (loop), src/lib/hamza/runner (background task), src/lib/hamza/pipeline (PR → CI → merge).
 */
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import { isProtectedBranch, isValidBranchName, teamGithubConfig } from "./github";

function slug(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return ascii || `team-${Date.now().toString(36)}`;
}

/** Feature branch: explicit branch in the human message wins, then the model's suggestion. */
export function chooseBranch(humanText: string, suggested: string, commitMessage: string): string {
  const named = humanText.match(/\b((?:feat|fix|chore|docs)\/[A-Za-z0-9._-]{2,60})/);
  const candidates = [named?.[1] ?? "", suggested.trim()];
  for (const candidate of candidates) {
    if (candidate && isValidBranchName(candidate) && !isProtectedBranch(candidate) && agentCommitBranchCheck(candidate, { liveBranch: teamGithubConfig().baseBranch }).ok) {
      return candidate;
    }
  }
  return `feat/${slug(commitMessage.replace(/^(feat|fix|chore|docs)(\(.+?\))?:\s*/i, ""))}`;
}

/** Human text that tries to approve by message: the approval itself must be the button click. */
export function looksLikeApprovalText(text: string): boolean {
  if (/(مش|غير|لا)\s*موافق/.test(text)) return false;
  return /(موافق|وافقت|اعتمد|approve|approved|go ahead|نفّذ|نفذ)/i.test(text);
}

export function namedBranch(text: string): string | null {
  const match = text.match(/\b((?:feat|fix|chore|docs)\/[A-Za-z0-9._-]{2,60}|main|master|agent-hub-latest)\b/);
  return match ? match[1] : null;
}
