"use client";

import { useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import type { TeamMessage, TeamProposal } from "@/lib/team/types";
import { DiffView } from "./DiffView";
import { InlineRich } from "./RichText";
import { decideProposal, teamErrorText } from "./teamApi";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { rich } from "@/lib/i18n/rich";
import { agentCommitBranchCheck } from "@/lib/security/agentBranches";

type Props = {
  proposal: TeamProposal;
  onDecided: (proposal: TeamProposal, message: TeamMessage) => void;
};

/** Developer diff card with "Approve & publish" / "Reject" (explicit human click + confirmation dialog). */
export function ProposalCard({ proposal, onDecided }: Props) {
  const { locale } = useI18n();
  const tm = teamMessages[locale];
  const t = tm.proposal;
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [branch, setBranch] = useState(proposal.targetBranch);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const open = proposal.status === "pending" || proposal.status === "failed";
  const chosenBranch = branch.trim();
  // Only a feat/*-style branch; the live branch and main are refused here and again on the server.
  const branchCheck = agentCommitBranchCheck(chosenBranch, { liveBranch: proposal.baseBranch });
  const canSubmit = mode === "reject" || (reviewed && branchCheck.ok);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setErrorText("");
    const result = await decideProposal(proposal.id, {
      action: mode === "reject" ? "reject" : "approve",
      confirm: true,
      branch: mode === "approve" ? chosenBranch : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setErrorText(teamErrorText(result, locale, tm));
      return;
    }
    setMode("idle");
    onDecided(result.data.proposal, result.data.message);
  };

  return (
    <section className={`team-proposal is-${proposal.status}`} aria-label={t.label}>
      <header className="team-proposal-head">
        <strong dir="ltr">{proposal.commitMessage}</strong>
        <span className={`team-status is-${proposal.status}`}>{t.status[proposal.status]}</span>
      </header>
      {proposal.summaryAr ? (
        <p>
          <InlineRich text={proposal.summaryAr} />
        </p>
      ) : null}
      <dl className="team-proposal-meta">
        <dt>{t.branch}</dt>
        <dd dir="ltr">
          {proposal.committedBranch ?? proposal.targetBranch} ← {proposal.baseBranch}
        </dd>
        {proposal.risksAr ? (
          <>
            <dt>{t.risks}</dt>
            <dd>{proposal.risksAr}</dd>
          </>
        ) : null}
        {proposal.testPlanAr ? (
          <>
            <dt>{t.tests}</dt>
            <dd>{proposal.testPlanAr}</dd>
          </>
        ) : null}
      </dl>
      {proposal.files.map((file) => (
        <DiffView key={file.path} file={file} />
      ))}
      <ul className="team-checks">
        {proposal.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      {proposal.commitUrl ? (
        <p className="team-commit-link">
          Commit:{" "}
          <a href={proposal.commitUrl} target="_blank" rel="noreferrer" dir="ltr">
            {proposal.commitSha?.slice(0, 7)}
          </a>{" "}
          · {proposal.decidedBy}
        </p>
      ) : null}
      {proposal.status === "rejected" && proposal.decidedBy ? <p className="muted">{fmt(t.rejectedBy, { name: proposal.decidedBy })}</p> : null}
      {proposal.error && proposal.status === "failed" ? <p className="team-error-text">{proposal.error}</p> : null}

      {open && mode === "idle" ? (
        <div className="team-proposal-actions">
          <button type="button" className="btn team-approve" onClick={() => setMode("approve")}>
            {t.approve}
          </button>
          <button type="button" className="btn ghost-btn team-reject" onClick={() => setMode("reject")}>
            {t.reject}
          </button>
        </div>
      ) : null}

      {open && mode !== "idle" ? (
        <div className="team-confirm" role="dialog" aria-modal="false" aria-label={t.confirmLabel}>
          {mode === "approve" ? (
            <>
              <p className="team-confirm-title">{t.confirmTitle}</p>
              <label className="team-field">
                {t.featureBranch}
                <input
                  className="team-input"
                  dir="ltr"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  aria-label={t.featureBranchName}
                  aria-invalid={!branchCheck.ok}
                />
              </label>
              <p className="team-hint">{rich(t.branchRule, { branch: <code dir="ltr">{proposal.baseBranch}</code> })}</p>
              <label className="team-check">
                <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
                {t.reviewed}
              </label>
            </>
          ) : (
            <p className="team-confirm-title">{t.rejectTitle}</p>
          )}
          <ApiErrorBanner error={errorText} errorAr={errorText} />
          <div className="team-proposal-actions">
            <button type="button" className="btn team-approve" disabled={!canSubmit || busy} onClick={() => void submit()}>
              {busy ? t.working : mode === "approve" ? t.confirmApprove : t.confirmReject}
            </button>
            <button type="button" className="btn ghost-btn" disabled={busy} onClick={() => setMode("idle")}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
