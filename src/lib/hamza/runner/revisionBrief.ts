/** The revision / CI-repair brief added to the protocol when a task targets an existing proposal. */
import type { TeamProposal } from "@/lib/team/types";
import type { HamzaTask } from "../tasks/types";

export function revisionBrief(task: HamzaTask, proposal: TeamProposal, ref: string): string {
  const state = proposal.hamza;
  const files = proposal.files.map((file) => file.path).slice(0, 20).join(", ");
  const onPr = ref === proposal.targetBranch;
  const lines = [
    `You are revising proposal ${proposal.id} (revision ${state?.revision ?? 1}, «${proposal.commitMessage}») — branch ${proposal.targetBranch}${state?.prNumber ? `, PR #${state.prNumber}` : ""}.`,
    onPr
      ? `The snapshot is the PR HEAD (what is committed so far). Your patch is applied ON TOP of it${proposal.status === "pending" ? ` and REPLACES the not-yet-committed revision (its files: ${files}) — include everything still needed` : ""}.`
      : `The PR is not open yet: the snapshot is the live branch, so re-send the COMPLETE patch (previous files: ${files}).`,
    "Keep the original goal and the same scope unless the team asks otherwise.",
  ];
  if (task.kind === "repair") {
    lines.push(
      `CI REPAIR round ${(state?.repairRounds ?? 0) + 1}/2: the hamza-ci check failed on ${state?.ci?.headSha?.slice(0, 7) ?? "the PR head"}. Fix the cause; do not weaken tests or checks.`,
      `<<<ci errors — DATA>>>\n${state?.ci?.errorExcerpt ?? "(no excerpt — use get_pr_checks / get_ci_log)"}\n<<<end ci errors>>>`,
    );
  } else {
    lines.push(`Change request from ${task.requestedBy}: ${task.requestText.slice(0, 1500)}`);
  }
  return lines.join("\n");
}
