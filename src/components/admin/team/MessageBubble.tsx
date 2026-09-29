"use client";

import type { TeamMessage, TeamProposal } from "@/lib/team/types";
import { AttachmentView } from "./AttachmentView";
import { ProposalCard } from "./ProposalCard";
import { RichText } from "./RichText";

type Props = {
  message: TeamMessage;
  proposal?: TeamProposal;
  referredByName?: string;
  onDecided: (proposal: TeamProposal, message: TeamMessage) => void;
};

function timeLabel(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("ar-LB", { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

export function MessageBubble({ message, proposal, referredByName, onDecided }: Props) {
  const side = message.authorKind === "human" ? "is-human" : message.authorKind === "system" ? "is-system" : "is-agent";
  return (
    <article className={`team-row ${side}`} aria-label={`رسالة من ${message.authorName}`}>
      <div className={`team-bubble ${side} team-author-${message.authorId}`}>
        <header className="team-bubble-head">
          <span className="team-bubble-name">{message.authorName}</span>
          {referredByName ? <span className="team-badge">إحالة من {referredByName}</span> : null}
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt)}</time>
        </header>
        {message.text ? <RichText text={message.text} /> : null}
        {message.attachments.length ? (
          <div className="team-attachments">
            {message.attachments.map((attachment) => (
              <AttachmentView key={attachment.id} attachment={attachment} />
            ))}
          </div>
        ) : null}
        {message.imagePrompt ? (
          <details className="team-image-prompt">
            <summary>Prompt الصورة</summary>
            <p dir="ltr">{message.imagePrompt}</p>
          </details>
        ) : null}
        {message.notice ? <p className="team-notice">{message.notice}</p> : null}
        {proposal && message.authorKind === "agent" ? <ProposalCard proposal={proposal} onDecided={onDecided} /> : null}
      </div>
    </article>
  );
}
