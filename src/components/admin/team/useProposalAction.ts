"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamMessage, TeamProposal } from "@/lib/team/types";
import { proposalAction, teamErrorText, type ProposalActionBody, type ProposalActionResponse } from "./teamApi";

export type ProposalUpdate = (proposal: TeamProposal, message?: TeamMessage) => void;

/** Runs one Hamza decision with busy + translated error state (errors never throw into React). */
export function useProposalAction(proposalId: string, onUpdated: ProposalUpdate) {
  const { locale } = useI18n();
  const tm = teamMessages[locale];
  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");

  const run = useCallback(
    async (body: ProposalActionBody, options?: { silent?: boolean }): Promise<ProposalActionResponse | null> => {
      if (!options?.silent) {
        setBusy(true);
        setErrorText("");
      }
      try {
        const result = await proposalAction(proposalId, body);
        if (!result.ok) {
          if (!options?.silent) setErrorText(teamErrorText(result, locale, tm));
          return null;
        }
        onUpdated(result.data.proposal, result.data.message);
        return result.data;
      } catch {
        if (!options?.silent) setErrorText(tm.errors.network);
        return null;
      } finally {
        if (!options?.silent) setBusy(false);
      }
    },
    [proposalId, onUpdated, locale, tm],
  );

  return { run, busy, errorText, setErrorText };
}
