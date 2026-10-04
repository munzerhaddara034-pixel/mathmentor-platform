"use client";

import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamProposal } from "@/lib/team/types";
import { ReviseBox } from "./ReviseBox";
import type { useProposalAction } from "./useProposalAction";

export type CardMode = "idle" | "approve" | "merge" | "reject" | "revert" | "revise";

type Props = {
  proposal: TeamProposal;
  mode: CardMode;
  setMode: (mode: CardMode) => void;
  action: ReturnType<typeof useProposalAction>;
};

const REJECTABLE = ["pending", "failed", "ci_running", "ci_failed", "ci_passed"];

/** Buttons that fit the current state, plus the reject / revert confirmations (44 px targets, sticky on mobile). */
export function ProposalActionBar({ proposal, mode, setMode, action }: Props) {
  const all = useNs(teamMessages);
  const t = all.proposal;
  const h = all.hamza;
  const { status } = proposal;
  const state = proposal.hamza;
  const confirm = async (kind: "reject" | "revert") => {
    const data = await action.run({ action: kind, confirm: true });
    if (data) setMode("idle");
  };

  if (mode === "revise") return <ReviseBox action={action} onClose={() => setMode("idle")} />;
  if (mode === "reject" || mode === "revert") {
    return (
      <div className="team-confirm" role="dialog" aria-modal="false" aria-label={t.confirmLabel}>
        <p className="team-confirm-title">{mode === "reject" ? t.rejectTitle : h.revertTitle}</p>
        <ApiErrorBanner error={action.errorText} errorAr={action.errorText} />
        <div className="team-proposal-actions team-sticky-actions">
          <button type="button" className="btn team-approve" disabled={action.busy} onClick={() => void confirm(mode)}>
            {action.busy ? t.working : mode === "reject" ? t.confirmReject : h.confirmRevert}
          </button>
          <button type="button" className="btn ghost-btn" disabled={action.busy} onClick={() => setMode("idle")}>
            {t.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="team-proposal-actions team-sticky-actions">
      {status === "pending" || status === "failed" ? (
        <button type="button" className="btn team-approve" onClick={() => setMode("approve")}>
          {t.approve}
        </button>
      ) : null}
      {status === "ci_passed" ? (
        <button type="button" className="btn team-approve" onClick={() => setMode("merge")}>
          {h.mergeButton}
        </button>
      ) : null}
      {status === "ci_running" || status === "ci_failed" ? (
        <button type="button" className="btn ghost-btn" disabled={action.busy} onClick={() => void action.run({ action: "refresh_ci", confirm: true })}>
          {action.busy ? t.working : h.refreshCi}
        </button>
      ) : null}
      {state?.prUrl ? (
        <a className="btn ghost-btn" href={state.prUrl} target="_blank" rel="noreferrer">
          {fmt(h.openPr, { n: state.prNumber ?? "" })}
        </a>
      ) : null}
      {status === "merged" && !state?.reverted && !state?.revertProposalId ? (
        <button type="button" className="btn ghost-btn" onClick={() => setMode("revert")}>
          {h.revert}
        </button>
      ) : null}
      {REJECTABLE.includes(status) ? (
        <button type="button" className="btn ghost-btn" onClick={() => setMode("revise")}>
          {h.askChange}
        </button>
      ) : null}
      {REJECTABLE.includes(status) ? (
        <button type="button" className="btn ghost-btn team-reject" onClick={() => setMode("reject")}>
          {t.reject}
        </button>
      ) : null}
    </div>
  );
}
