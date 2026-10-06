"use client";

import { teamAuthorDisplayName, type TeamMessage, type TeamProposal } from "@/lib/team/types";
import { AttachmentView } from "./AttachmentView";
import { ProposalCard } from "./ProposalCard";
import { TaskCard } from "./TaskCard";
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import { RichText } from "./RichText";
import { useI18n } from "@/components/i18n/I18nProvider";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";

type Props = {
  message: TeamMessage;
  proposal?: TeamProposal;
  task?: PublicHamzaTask;
  referredByName?: string;
  onDecided: (proposal: TeamProposal, message?: TeamMessage) => void;
  onTaskUpdated: (task: PublicHamzaTask) => void;
};

function timeLabel(iso: string, locale: Locale) {
  try {
    return new Date(iso).toLocaleTimeString(INTL_LOCALE[locale], { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "";
  }
}

export function MessageBubble({ message, proposal, task, referredByName, onDecided, onTaskUpdated }: Props) {
  const { locale } = useI18n();
  const t = teamMessages[locale];
  const authorName = teamAuthorDisplayName(message, t.agents);
  const side = message.authorKind === "human" ? "is-human" : message.authorKind === "system" ? "is-system" : "is-agent";
  return (
    <article className={`team-row ${side}`} aria-label={fmt(t.messageFrom, { name: authorName })}>
      <div className={`team-bubble ${side} team-author-${message.authorId}`}>
        <header className="team-bubble-head">
          <span className="team-bubble-name">{authorName}</span>
          {referredByName ? <span className="team-badge">{fmt(t.referredBy, { name: referredByName })}</span> : null}
          <time dateTime={message.createdAt}>{timeLabel(message.createdAt, locale)}</time>
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
            <summary>{t.imagePrompt}</summary>
            <p dir="ltr">{message.imagePrompt}</p>
          </details>
        ) : null}
        {message.notice ? <p className="team-notice">{message.notice}</p> : null}
        {task ? <TaskCard task={task} onUpdated={onTaskUpdated} /> : null}
        {proposal && message.authorKind === "agent" ? <ProposalCard proposal={proposal} onDecided={onDecided} /> : null}
      </div>
    </article>
  );
}
