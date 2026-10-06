"use client";

import { useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamProposal } from "@/lib/team/types";
import { ApprovalCodeBox } from "./ApprovalCodeBox";
import { useProposalAction, type ProposalUpdate } from "./useProposalAction";

type Props = { proposal: TeamProposal; onUpdated: ProposalUpdate; onClose: () => void };

/** Approval #2 (CI green only): a separate code + typing the live branch name → squash merge. */
export function MergePanel({ proposal, onUpdated, onClose }: Props) {
  const all = useNs(teamMessages);
  const h = all.hamza;
  const { run, busy, errorText } = useProposalAction(proposal.id, onUpdated);
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const live = proposal.baseBranch;
  const canSubmit = typed.trim() === live && code.trim().length >= 6 && !busy;

  const requestCode = async () => {
    const data = await run({ action: "issue_code", confirm: true, step: "merge" });
    if (data?.code && data.expiresAt) setIssued({ code: data.code, expiresAt: data.expiresAt });
  };
  const submit = async () => {
    if (!canSubmit) return;
    const data = await run({ action: "merge", confirm: true, code: code.trim(), typedBranch: typed.trim() });
    if (data) onClose();
  };

  return (
    <div className="team-confirm" role="dialog" aria-modal="false" aria-label={fmt(h.mergeTitle, { branch: live })}>
      <p className="team-confirm-title">{fmt(h.mergeTitle, { branch: live })}</p>
      <p className="team-hint">{h.mergeRule}</p>
      <button type="button" className="btn ghost-btn" disabled={busy} onClick={() => void requestCode()}>
        {h.requestCode}
      </button>
      <ApprovalCodeBox issued={issued} active={proposal.hamza?.activeCode?.merge} value={code} onChange={setCode} />
      <label className="team-field">
        {fmt(h.typeBranch, { branch: live })}
        <input className="team-input" dir="ltr" value={typed} onChange={(event) => setTyped(event.target.value)} aria-invalid={typed.length > 0 && typed.trim() !== live} />
      </label>
      <ApiErrorBanner error={errorText} errorAr={errorText} />
      <div className="team-proposal-actions team-sticky-actions">
        <button type="button" className="btn team-approve" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? all.proposal.working : h.confirmMerge}
        </button>
        <button type="button" className="btn ghost-btn" disabled={busy} onClick={onClose}>
          {all.proposal.cancel}
        </button>
      </div>
    </div>
  );
}
