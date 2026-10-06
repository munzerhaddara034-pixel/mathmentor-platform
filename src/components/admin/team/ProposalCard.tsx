"use client";

import { useEffect, useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import type { TeamProposal } from "@/lib/team/types";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { ApprovePanel } from "./ApprovePanel";
import { DiffView } from "./DiffView";
import { MergePanel } from "./MergePanel";
import { ProposalActionBar, type CardMode } from "./ProposalActionBar";
import { ProposalHeaderStrip } from "./ProposalHeaderStrip";
import { ProposalTimeline } from "./ProposalTimeline";
import { InlineRich } from "./RichText";
import { useProposalAction, type ProposalUpdate } from "./useProposalAction";

type Props = { proposal: TeamProposal; onDecided: ProposalUpdate };

const CI_POLL_MS = 30_000;

/** Hamza proposal: header strip, timeline, diff, then Approval #1 (PR) / Approval #2 (merge) / reject. */
export function ProposalCard({ proposal, onDecided }: Props) {
  const all = useNs(teamMessages);
  const t = all.proposal;
  const [mode, setMode] = useState<CardMode>("idle");
  const action = useProposalAction(proposal.id, onDecided);
  const { run } = action;

  // While CI runs, poll quietly (the server worker also polls; this keeps an open card fresh).
  useEffect(() => {
    if (proposal.status !== "ci_running") return;
    const timer = setInterval(() => void run({ action: "refresh_ci", confirm: true }, { silent: true }), CI_POLL_MS);
    return () => clearInterval(timer);
  }, [proposal.status, run]);

  const close = () => setMode("idle");
  return (
    <section className={`team-proposal is-${proposal.status}`} aria-label={t.label}>
      <header className="team-proposal-head">
        <strong dir="ltr">{proposal.commitMessage}</strong>
        <span className={`team-status is-${proposal.status}`}>{t.status[proposal.status]}</span>
      </header>
      <ProposalHeaderStrip proposal={proposal} />
      <ProposalTimeline proposal={proposal} />
      {proposal.summaryAr ? (
        <p>
          <InlineRich text={proposal.summaryAr} />
        </p>
      ) : null}
      <dl className="team-proposal-meta">
        <dt>{t.branch}</dt>
        <dd dir="ltr">
          {proposal.committedBranch ?? proposal.targetBranch} → {proposal.baseBranch}
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
        {proposal.hamza?.revertOf ? (
          <>
            <dt>↩</dt>
            <dd dir="ltr">{fmt(all.hamza.revertOf, { id: proposal.hamza.revertOf })}</dd>
          </>
        ) : null}
      </dl>
      <DiffView files={proposal.files} />
      <ul className="team-checks">
        {proposal.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      {proposal.status === "rejected" && proposal.decidedBy ? <p className="muted">{fmt(t.rejectedBy, { name: proposal.decidedBy })}</p> : null}
      {proposal.hamza?.lastError || (proposal.error && proposal.status === "failed") ? (
        <p className="team-error-text">
          {all.hamza.lastError}: {proposal.hamza?.lastError ?? proposal.error}
        </p>
      ) : null}
      {mode === "approve" ? <ApprovePanel proposal={proposal} onUpdated={onDecided} onClose={close} /> : null}
      {mode === "merge" ? <MergePanel proposal={proposal} onUpdated={onDecided} onClose={close} /> : null}
      {mode !== "approve" && mode !== "merge" ? <ProposalActionBar proposal={proposal} mode={mode} setMode={setMode} action={action} /> : null}
      {mode === "idle" ? <ApiErrorBanner error={action.errorText} errorAr={action.errorText} /> : null}
    </section>
  );
}
