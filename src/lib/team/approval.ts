/**
 * «موافقة ونشر» / «رفض» — the ONLY code path that commits. Called from the approval route after a human click.
 */
import { createId } from "@/lib/ids";
import type { TeamActor } from "./agents";
import { MAX_CHANGED_LINES, staticFindings } from "./codeChecks";
import { FORBIDDEN_BRANCHES, commitFilesToBranch, isProtectedBranch, isValidBranchName, teamGithubConfig } from "./github";
import { teamRepo } from "./store";
import type { TeamMessage, TeamProposal } from "./types";

export type DecisionInput = {
  proposalId: string;
  action: "approve" | "reject";
  confirm: boolean;
  branch?: string;
  confirmBranch?: string;
  actor: TeamActor;
};

export type DecisionResult =
  | { ok: true; proposal: TeamProposal; message: TeamMessage }
  | { ok: false; status: number; error: string; errorAr: string };

function fail(status: number, error: string, errorAr: string): DecisionResult {
  return { ok: false, status, error, errorAr };
}

function addedLines(diff: string) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1));
}

async function post(proposal: TeamProposal, text: string, notice?: string): Promise<TeamMessage> {
  const message: TeamMessage = {
    id: createId("tmsg"),
    channel: proposal.channel,
    authorKind: "system",
    authorId: "system",
    authorName: "المنصة",
    text,
    attachments: [],
    createdAt: new Date().toISOString(),
    proposalId: proposal.id,
    notice,
  };
  await teamRepo().addMessage(message);
  return message;
}

export async function decideProposal(input: DecisionInput): Promise<DecisionResult> {
  if (!input.confirm) return fail(400, "Explicit confirmation required.", "يلزم تأكيد صريح.");
  const repo = teamRepo();
  const proposal = await repo.getProposal(input.proposalId);
  if (!proposal) return fail(404, "Proposal not found.", "الـ Diff غير موجود.");
  const now = new Date().toISOString();

  if (input.action === "reject") {
    const updated = await repo.transitionProposal(proposal.id, ["pending", "failed"], {
      status: "rejected",
      decidedBy: input.actor.name,
      decidedAt: now,
    });
    if (!updated) return fail(409, "Proposal is no longer pending.", "هذا الـ Diff لم يعد بانتظار قرار.");
    const message = await post(updated, `❌ رفض ${input.actor.name} الـ Diff «${updated.commitMessage}». لم يحدث أي Commit.`);
    return { ok: true, proposal: updated, message };
  }

  const config = teamGithubConfig();
  const branch = (input.branch || proposal.targetBranch).trim();
  if (!isValidBranchName(branch)) return fail(400, "Invalid branch name.", "اسم الفرع غير صالح.");
  if (FORBIDDEN_BRANCHES.includes(branch)) {
    return fail(403, `Writing to ${branch} is blocked from the platform.`, `الكتابة على ${branch} ممنوعة من داخل المنصة.`);
  }
  if (isProtectedBranch(branch, config) && input.confirmBranch !== branch) {
    return fail(
      400,
      "Type the protected branch name to confirm.",
      `${branch} فرع محمي (Render يبني منه). اكتب اسمه حرفياً في خانة التأكيد.`,
    );
  }
  // Re-run the guards on the stored content (defence in depth).
  const findings = staticFindings(
    proposal.files.map((file) => ({ path: file.path, content: file.newContent, addedLines: addedLines(file.diff) })),
  );
  const changed = proposal.files.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  if (changed > MAX_CHANGED_LINES) findings.push(`حجم التغيير ${changed} سطر يتجاوز الحد.`);
  if (findings.length) return fail(422, "Proposal failed safety checks.", findings.join(" · "));

  const locked = await repo.transitionProposal(proposal.id, ["pending", "failed"], {
    status: "committing",
    decidedBy: input.actor.name,
    decidedAt: now,
  });
  if (!locked) return fail(409, "Proposal is no longer pending.", "هذا الـ Diff قيد التنفيذ أو حُسم مسبقاً.");

  const result = await commitFilesToBranch(
    {
      branch,
      createFromBase: !isProtectedBranch(branch, config),
      message: `${proposal.commitMessage}\n\nApproved in /admin/team by ${input.actor.name}. Proposal ${proposal.id}.`,
      files: proposal.files.map((file) => ({ path: file.path, content: file.newContent, baseSha: file.baseSha })),
    },
    config,
  );
  if (!result.ok) {
    const failed = (await repo.transitionProposal(proposal.id, ["committing"], { status: "failed", error: result.error })) ?? locked;
    const message = await post(failed, `⚠️ فشل الـ Commit على ${branch}: ${result.error}\nلم يُكتب شيء. يمكنك إعادة المحاولة أو الرفض.`);
    return { ok: true, proposal: failed, message };
  }
  const committed =
    (await repo.transitionProposal(proposal.id, ["committing"], {
      status: "committed",
      committedBranch: result.branch,
      commitSha: result.sha,
      commitUrl: result.url,
      error: undefined,
    })) ?? locked;
  const live = result.branch === config.baseBranch;
  const text = [
    `✅ Commit بموافقة ${input.actor.name}`,
    `- الفرع: ${result.branch}${result.branchCreated ? ` (أُنشئ من ${config.baseBranch})` : ""}`,
    `- SHA: ${result.sha.slice(0, 7)} — ${result.url}`,
    `- الملفات: ${proposal.files.map((file) => file.path).join("، ")}`,
    "- الفحوص داخل المنصة: الأسرار ✓ · any/@ts-ignore ✓ · صياغة TypeScript ✓",
    "- tsc --noEmit و npm run build: لم يُشغَّلا داخل خادم Render — شغّلهما على هذا الفرع قبل الدمج.",
    live ? "- هذا هو الفرع الحيّ: Render سيعيد النشر تلقائياً." : `- Render لا ينشر هذا الفرع؛ الدمج في ${config.baseBranch} يحتاج موافقة منفصلة.`,
  ].join("\n");
  const message = await post(committed, text);
  return { ok: true, proposal: committed, message };
}
