/**
 * «Revert»: a merged Hamza change → a NEW proposal that restores every touched file to its state before the
 * squash-merge, on fix/revert-<sha7>. It goes through the same Approval #1 → PR → hamza-ci → Approval #2.
 * Read-only here (GitHub reads + store writes); the pipeline does the branch/PR/merge.
 */
import { createId } from "@/lib/ids";
import { unifiedDiff } from "@/lib/team/diff";
import type { TeamMessage, TeamProposal, TeamProposalFile } from "@/lib/team/types";
import type { HamzaGithubReader } from "./github/types";
import { addEvent } from "./timeline";
import { fail, initialHamzaState, save, stateOf, type PipelineActor, type PipelineDeps, type PipelineResult } from "./pipeline/shared";

function touchedPaths(files: TeamProposalFile[]): string[] {
  return [...new Set(files.flatMap((file) => (file.change === "rename" && file.oldPath ? [file.oldPath, file.path] : [file.path])))];
}

/** Revert files: content at `parentSha` (before) restored over the current base head. Null = conflict path. */
export async function revertFiles(github: HamzaGithubReader, input: { paths: string[]; parentSha: string; mergeSha: string; headRef: string }): Promise<{ files: TeamProposalFile[]; conflict?: string }> {
  const files: TeamProposalFile[] = [];
  for (const path of input.paths) {
    const [before, merged, head] = await Promise.all([github.readFile(path, input.parentSha), github.readFile(path, input.mergeSha), github.readFile(path, input.headRef)]);
    // Someone changed the file after the merge: a blind restore would drop their work.
    if ((head?.sha ?? null) !== (merged?.sha ?? null)) return { files: [], conflict: path };
    if ((before?.sha ?? null) === (head?.sha ?? null)) continue;
    const after = before?.content ?? "";
    const diff = unifiedDiff(path, head?.content ?? null, after);
    files.push({
      path,
      baseSha: head?.sha ?? null,
      isNew: !head,
      newContent: after,
      diff: diff.text,
      additions: diff.additions,
      deletions: diff.deletions,
      change: !before ? "delete" : !head ? "add" : "modify",
      ...(head ? { oldContent: head.content } : {}),
    });
  }
  return { files };
}

export async function requestRevert(deps: PipelineDeps, input: { proposalId: string; actor: PipelineActor }): Promise<PipelineResult> {
  if (!deps.canMerge(input.actor)) return fail(403, "Not allowed to revert live changes.", "حسابك غير مخوّل بالتراجع عن تغييرات الفرع الحيّ.");
  const original = await deps.repo.getProposal(input.proposalId);
  if (!original) return fail(404, "Proposal not found.", "الاقتراح غير موجود.");
  const state = stateOf(original);
  if (original.status !== "merged" || !state.mergeSha) return fail(409, "Only merged changes can be reverted.", "التراجع متاح فقط لتغيير مدموج.", original);
  if (state.reverted || state.revertProposalId) return fail(409, "A revert already exists.", "يوجد طلب تراجع لهذا التغيير مسبقاً.", original);
  const github = deps.reader();
  const base = deps.config.baseBranch.branch;
  const headSha = await github.getBranchSha(base);
  const parentSha = (await github.listCommits({ ref: state.mergeSha, n: 2 }))[1]?.sha;
  if (!headSha || !parentSha) return fail(502, "Could not read the merge commit.", "تعذّر قراءة commit الدمج.", original);
  const { files, conflict } = await revertFiles(github, { paths: touchedPaths(original.files), parentSha, mergeSha: state.mergeSha, headRef: headSha });
  if (conflict) return fail(409, `${conflict} changed after the merge — revert it manually.`, `الملف ${conflict} تغيّر بعد الدمج — التراجع الآلي غير آمن، اطلب من حمزة تعديلاً محدداً.`, original);
  if (!files.length) return fail(409, "Nothing to revert (files already match).", "لا شيء للتراجع عنه.", original);

  const now = deps.now();
  const at = now.toISOString();
  const sha7 = state.mergeSha.slice(0, 7);
  const revert: TeamProposal = {
    id: createId("prop"),
    channel: original.channel,
    messageId: createId("tmsg"),
    requestText: `Revert ${original.id} (${original.commitMessage})`,
    requestedBy: input.actor.name,
    summaryAr: `تراجع عن «${original.commitMessage}» (squash ${sha7}) — يعيد ${files.length} ملف إلى حالته قبل الدمج.`,
    risksAr: "يزيل ميزة/إصلاح الاقتراح الأصلي من الفرع الحيّ.",
    testPlanAr: "hamza-ci على PR التراجع، ثم فحص الصفحة المتأثرة بعد إعادة النشر.",
    commitMessage: `revert: ${original.commitMessage}`.slice(0, 120),
    baseBranch: base,
    targetBranch: `fix/revert-${sha7}`,
    files,
    status: "pending",
    checks: [`Revert of squash ${sha7}: restores the pre-merge content; conflict guard vs ${base} head ${headSha.slice(0, 7)}`],
    createdAt: at,
    updatedAt: at,
  };
  revert.hamza = initialHamzaState(revert, { revertOf: original.id, baseCommitSha: headSha });
  // Claim the original first (CAS) so two clicks cannot create two reverts.
  const marked = await save(deps, original, ["merged"], "merged", { hamza: addEvent({ ...state, revertProposalId: revert.id }, "revert_requested", now, input.actor.name, revert.id) });
  const winner = marked ? (await deps.repo.getProposal(original.id))?.hamza?.revertProposalId : undefined;
  if (winner !== revert.id) return fail(409, "The original changed meanwhile.", "تغيّرت حالة الاقتراح الأصلي.", original);
  await deps.repo.saveProposal(revert);
  await deps.audit("hamza.revert.requested", { actor: input.actor, ip: input.actor.ip, details: { proposalId: original.id, sha: state.mergeSha, branch: revert.targetBranch, result: revert.id } });
  // Agent-authored message whose id is revert.messageId, so the chat renders the proposal card under it.
  const message: TeamMessage = {
    id: revert.messageId,
    channel: revert.channel,
    authorKind: "agent",
    authorId: "developer",
    authorName: "حمزة",
    text: `↩️ ${input.actor.name} طلب التراجع عن «${original.commitMessage}». جهّزت اقتراح التراجع على ${revert.targetBranch} — يحتاج الموافقة #1 ثم CI ثم الموافقة #2 مثل أي تغيير.`,
    attachments: [],
    createdAt: at,
    proposalId: revert.id,
  };
  await deps.repo.addMessage(message);
  return { ok: true, proposal: revert, message };
}
