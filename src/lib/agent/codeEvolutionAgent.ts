/**
 * "Path C" — the chat-widget / voice code-evolution engine — is DISABLED.
 *
 * It used to let staff wording in the site chat or a voice note («صفحة», «غير», «عدّل» …) make Gemini
 * rewrite a whole file and commit it straight to GITHUB_BRANCH with no human review, and it replied
 * "success" even when nothing happened. It now never calls Gemini or GitHub and never claims success.
 * Code changes go through Hamza in /admin/team (feat/* branch + explicit human approval) only.
 * The previous implementation is in git history (release-2026-10-01 before this change).
 */
import {
  CHAT_CODE_EVOLUTION_ENABLED,
  CODE_EVOLUTION_DISABLED_AR,
  CODE_EVOLUTION_DISABLED_EN,
} from "@/lib/security/agentBranches";

export interface CodeEvolutionPlan {
  targetFilePath: string;
  explanation: string;
  proposedCode: string;
  commitMessage: string;
}

export type CodeEvolutionResult = {
  success: false;
  disabled: true;
  fileUpdated: string;
  commitMessage: string;
  messageAr: string;
  messageEn: string;
};

export function codeEvolutionEnabled(): boolean {
  return CHAT_CODE_EVOLUTION_ENABLED;
}

/** Always refuses: no Gemini call, no GitHub read/write. */
export async function executeCodeEvolution(params: { prompt: string; branch?: string }): Promise<CodeEvolutionResult> {
  console.warn("codeEvolution: request refused — chat/voice code evolution is disabled", {
    promptChars: params.prompt?.length ?? 0,
  });
  return {
    success: false,
    disabled: true,
    fileUpdated: "",
    commitMessage: "",
    messageAr: CODE_EVOLUTION_DISABLED_AR,
    messageEn: CODE_EVOLUTION_DISABLED_EN,
  };
}
