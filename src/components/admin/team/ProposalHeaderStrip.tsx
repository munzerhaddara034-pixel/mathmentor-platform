"use client";

import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamProposal } from "@/lib/team/types";
import { usd } from "./hamzaFormat";

/** Files, +/−, risk, tier, cost (estimate / actual), model, revision and target branch. */
export function ProposalHeaderStrip({ proposal }: { proposal: TeamProposal }) {
  const h = useNs(teamMessages).hamza;
  const state = proposal.hamza;
  const additions = proposal.files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = proposal.files.reduce((sum, file) => sum + file.deletions, 0);
  const cost = state?.cost;
  return (
    <ul className="team-strip">
      <li>
        {fmt(h.header.files, { n: proposal.files.length })} <span className="team-add">+{additions}</span> <span className="team-del">−{deletions}</span>
      </li>
      {state ? (
        <>
          <li className={`team-risk is-${state.riskLevel}`}>
            {h.header.risk}: {h.risk[state.riskLevel]}
          </li>
          <li>
            {h.header.tier}: {h.tier[state.tier]}
          </li>
          <li>{fmt(h.header.revision, { n: state.revision })}</li>
        </>
      ) : null}
      {cost ? (
        <li>
          {h.header.cost}: {usd(cost.usd)}
          {cost.estimateUsd !== undefined ? ` (${fmt(h.header.estimate, { usd: usd(cost.estimateUsd) })})` : ""}
        </li>
      ) : null}
      {cost?.models.length ? (
        <li dir="ltr">
          {h.header.model}: {cost.models.join(" → ")}
        </li>
      ) : null}
      <li dir="ltr">
        {h.header.target}: {proposal.baseBranch}
      </li>
    </ul>
  );
}
