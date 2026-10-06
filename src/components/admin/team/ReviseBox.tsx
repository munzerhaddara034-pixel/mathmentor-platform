"use client";

import { useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { useProposalAction } from "./useProposalAction";

type Props = { action: ReturnType<typeof useProposalAction>; onClose: () => void };

/** «Ask Hamza to change…»: queues a new revision of the same proposal (same branch / PR). */
export function ReviseBox({ action, onClose }: Props) {
  const all = useNs(teamMessages);
  const h = all.hamza;
  const [text, setText] = useState("");
  const send = async () => {
    const data = await action.run({ action: "revise", confirm: true, text: text.trim() });
    if (data) onClose();
  };
  return (
    <div className="team-confirm" role="group" aria-label={h.askChange}>
      <label className="team-confirm-title" htmlFor="hamza-revise">
        {h.askChange}
      </label>
      <textarea id="hamza-revise" className="team-revise-input" rows={3} maxLength={2000} value={text} placeholder={h.askChangePlaceholder} onChange={(event) => setText(event.target.value)} />
      <p className="muted team-task-line">{h.askChangeNote}</p>
      <ApiErrorBanner error={action.errorText} errorAr={action.errorText} />
      <div className="team-proposal-actions team-sticky-actions">
        <button type="button" className="btn team-approve" disabled={action.busy || text.trim().length < 3} onClick={() => void send()}>
          {action.busy ? all.proposal.working : h.askChangeSend}
        </button>
        <button type="button" className="btn ghost-btn" disabled={action.busy} onClick={onClose}>
          {all.proposal.cancel}
        </button>
      </div>
    </div>
  );
}
