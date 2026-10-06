"use client";

import { useNs } from "@/components/i18n/useNs";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { teamMessages, type TeamMessages } from "@/lib/i18n/ns/team";
import { timelineChips, type TimelineChip } from "@/lib/hamza/timeline";
import type { TeamProposal } from "@/lib/team/types";
import { beirutTime } from "./hamzaFormat";

function chipLabel(chip: TimelineChip, c: TeamMessages["hamza"]["chips"]): string {
  if (chip.key === "approved") return chip.prNumber ? fmt(c.approvedPr, { n: chip.prNumber }) : c.approved;
  if (chip.key === "ci") return chip.ci === "passed" ? c.ciPassed : chip.ci === "failed" ? c.ciFailed : chip.ci === "running" ? c.ciRunning : c.ci;
  if (chip.key === "deployed") return chip.state === "reverted" ? c.reverted : c.deployed;
  return c[chip.key];
}

/** Proposed → Approved (PR #n) → CI → Merged → Deployed / Reverted. */
export function ProposalTimeline({ proposal }: { proposal: TeamProposal }) {
  const c = useNs(teamMessages).hamza.chips;
  const { locale } = useI18n();
  const chips = timelineChips(proposal.status, proposal.hamza);
  return (
    <ol className="team-chips" aria-label="timeline">
      {chips.map((chip) => (
        <li key={chip.key} className={`team-chip is-${chip.state}`}>
          <span>{chipLabel(chip, c)}</span>
          {chip.at && chip.state !== "todo" ? <time dateTime={chip.at}>{beirutTime(chip.at, locale)}</time> : null}
        </li>
      ))}
    </ol>
  );
}
