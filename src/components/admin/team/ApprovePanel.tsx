"use client";

import { useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { rich } from "@/lib/i18n/rich";
import { changedLines } from "@/lib/hamza/limits";
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";
import type { TeamProposal } from "@/lib/team/types";
import { ApprovalCodeBox } from "./ApprovalCodeBox";
import { useProposalAction, type ProposalUpdate } from "./useProposalAction";

type Props = { proposal: TeamProposal; onUpdated: ProposalUpdate; onClose: () => void };

/** Approval #1: request a code bound to this diff + branch, type it, tick "reviewed" → feat/* branch + PR. */
export function ApprovePanel({ proposal, onUpdated, onClose }: Props) {
  const all = useNs(teamMessages);
  const t = all.proposal;
  const h = all.hamza;
  const { run, busy, errorText } = useProposalAction(proposal.id, onUpdated);
  const [branch, setBranch] = useState(proposal.targetBranch);
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [code, setCode] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [allowLarge, setAllowLarge] = useState(false);
  const chosen = branch.trim();
  // Only a feat/*-style branch; the live branch and main are refused here and again on the server.
  const branchCheck = agentCommitBranchCheck(chosen, { liveBranch: proposal.baseBranch });
  const large = proposal.hamza?.tier === "large";
  const canSubmit = branchCheck.ok && reviewed && code.trim().length >= 6 && (!large || allowLarge) && !busy;

  const requestCode = async () => {
    const data = await run({ action: "issue_code", confirm: true, step: "open_pr", branch: chosen });
    if (data?.code && data.expiresAt) setIssued({ code: data.code, expiresAt: data.expiresAt });
  };
  const submit = async () => {
    if (!canSubmit) return;
    const data = await run({ action: "approve", confirm: true, code: code.trim(), reviewed, allowLarge, branch: chosen });
    if (data) onClose();
  };

  return (
    <div className="team-confirm" role="dialog" aria-modal="false" aria-label={t.confirmLabel}>
      <p className="team-confirm-title">{h.approveTitle}</p>
      <label className="team-field">
        {t.featureBranch}
        <input
          className="team-input"
          dir="ltr"
          value={branch}
          disabled={Boolean(issued) || Boolean(proposal.hamza?.prNumber)}
          onChange={(event) => setBranch(event.target.value)}
          aria-label={t.featureBranchName}
          aria-invalid={!branchCheck.ok}
        />
      </label>
      <p className="team-hint">{rich(t.branchRule, { branch: <code dir="ltr">{proposal.baseBranch}</code> })}</p>
      <button type="button" className="btn ghost-btn" disabled={busy || !branchCheck.ok} onClick={() => void requestCode()}>
        {h.requestCode}
      </button>
      <ApprovalCodeBox issued={issued} active={proposal.hamza?.activeCode?.open_pr} value={code} onChange={setCode} />
      {large ? (
        <label className="team-check">
          <input type="checkbox" checked={allowLarge} onChange={(event) => setAllowLarge(event.target.checked)} />
          {fmt(h.large, { files: proposal.files.length, lines: changedLines(proposal.files) })}
        </label>
      ) : null}
      <label className="team-check">
        <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
        {t.reviewed}
      </label>
      <ApiErrorBanner error={errorText} errorAr={errorText} />
      <div className="team-proposal-actions team-sticky-actions">
        <button type="button" className="btn team-approve" disabled={!canSubmit} onClick={() => void submit()}>
          {busy ? t.working : h.confirmOpenPr}
        </button>
        <button type="button" className="btn ghost-btn" disabled={busy} onClick={onClose}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
