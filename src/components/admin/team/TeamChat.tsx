"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { routeHumanMessage } from "@/lib/team/routing";
import {
  TEAM_AGENT_NAMES_AR,
  TEAM_CHANNELS,
  type TeamChannelId,
  type TeamMessage,
  type TeamProposal,
} from "@/lib/team/types";
import { ChannelList } from "./ChannelList";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { TeamThreadSkeleton, TeamTypingBubble } from "./TeamChatSkeleton";
import { fetchThread, sendTeamMessage } from "./teamApi";

type Thread = { messages: TeamMessage[]; proposals: Record<string, TeamProposal>; loaded: boolean };

const EMPTY: Thread = { messages: [], proposals: {}, loaded: false };

const PLACEHOLDERS: Record<TeamChannelId, string> = {
  team: "اكتب للفريق… (@محمد، @سامي، @المطوّر)",
  mohamed: "اكتب لمحمد: موعد، موجز، حل رياضيات، نموذج امتحان…",
  sami: "اكتب لسامي: بانر، بوستر، واجهة، فيديو…",
  developer: "اكتب للمبرمج: التعديل المطلوب — يقترح Diff ثم ينتظر موافقتك",
};

function indexProposals(list: TeamProposal[]): Record<string, TeamProposal> {
  return Object.fromEntries(list.map((proposal) => [proposal.id, proposal]));
}

/** Messenger-style team chat for staff (RTL, mobile-first). */
export function TeamChat({ staffName }: { staffName: string }) {
  const [channel, setChannel] = useState<TeamChannelId>("team");
  const [threads, setThreads] = useState<Partial<Record<TeamChannelId, Thread>>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<TeamChannelId | null>(null);
  const [typingNames, setTypingNames] = useState("");
  const [errorAr, setErrorAr] = useState("");
  const [storage, setStorage] = useState<"postgres" | "file" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = threads[channel] ?? EMPTY;
  const meta = TEAM_CHANNELS.find((item) => item.id === channel) ?? TEAM_CHANNELS[0];

  const load = useCallback(async (target: TeamChannelId) => {
    setLoading(true);
    setErrorAr("");
    const result = await fetchThread(target);
    setLoading(false);
    if (!result.ok) {
      setErrorAr(result.errorAr);
      return;
    }
    setStorage(result.data.storage);
    setThreads((current) => ({
      ...current,
      [target]: { messages: result.data.messages, proposals: indexProposals(result.data.proposals), loaded: true },
    }));
  }, []);

  useEffect(() => {
    void load(channel);
  }, [channel, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.messages.length, sending]);

  const referredNames = useMemo(() => {
    const byId = new Map(thread.messages.map((message) => [message.id, message.authorName]));
    return (message: TeamMessage) => (message.referredById ? byId.get(message.referredById) : undefined);
  }, [thread.messages]);

  const onSend = async (text: string, files: File[]) => {
    const target = channel;
    const route = routeHumanMessage(target, text);
    setTypingNames(route.responders.map((agent) => TEAM_AGENT_NAMES_AR[agent]).join(" و"));
    setSending(target);
    setErrorAr("");
    const optimistic: TeamMessage = {
      id: `local-${Date.now()}`,
      channel: target,
      authorKind: "human",
      authorId: "me",
      authorName: staffName,
      text,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    setThreads((current) => {
      const base = current[target] ?? EMPTY;
      return { ...current, [target]: { ...base, messages: [...base.messages, optimistic] } };
    });
    const result = await sendTeamMessage(target, text, files);
    setSending(null);
    if (!result.ok) {
      setErrorAr(result.errorAr);
      setThreads((current) => {
        const base = current[target] ?? EMPTY;
        return { ...current, [target]: { ...base, messages: base.messages.filter((m) => m.id !== optimistic.id) } };
      });
      return false;
    }
    const { message, replies, proposals } = result.data;
    setThreads((current) => {
      const base = current[target] ?? EMPTY;
      return {
        ...current,
        [target]: {
          loaded: true,
          messages: [...base.messages.filter((m) => m.id !== optimistic.id), message, ...replies],
          proposals: { ...base.proposals, ...indexProposals(proposals) },
        },
      };
    });
    return true;
  };

  const onDecided = (proposal: TeamProposal, message: TeamMessage) => {
    setThreads((current) => {
      const base = current[proposal.channel] ?? EMPTY;
      return {
        ...current,
        [proposal.channel]: {
          ...base,
          messages: [...base.messages, message],
          proposals: { ...base.proposals, [proposal.id]: proposal },
        },
      };
    });
  };

  return (
    <div className="team-chat" dir="rtl" lang="ar">
      <ChannelList active={channel} unread={{}} onSelect={setChannel} />
      <section className="team-thread" aria-label={`محادثة ${meta.labelAr}`}>
        <header className="team-thread-head">
          <span className={`team-avatar team-avatar-${meta.id}`} aria-hidden>
            {meta.avatar}
          </span>
          <div>
            <h2>{meta.labelAr}</h2>
            <p className="muted">{meta.subtitleAr}</p>
          </div>
          {storage ? (
            <span className={`team-storage is-${storage}`} title="مكان حفظ الرسائل">
              {storage === "postgres" ? "محفوظ على Postgres" : "حفظ محلي (ملف)"}
            </span>
          ) : null}
        </header>
        <div className="team-messages" aria-live="polite">
          {loading && !thread.loaded ? <TeamThreadSkeleton /> : null}
          {thread.loaded && !thread.messages.length ? (
            <p className="team-empty">لا رسائل بعد. ابدأ المحادثة — كل الرسائل محفوظة للتدقيق.</p>
          ) : null}
          {thread.messages.map((message) => {
            const proposal = message.proposalId ? thread.proposals[message.proposalId] : undefined;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                proposal={proposal && proposal.messageId === message.id ? proposal : undefined}
                referredByName={referredNames(message)}
                onDecided={onDecided}
              />
            );
          })}
          {sending === channel ? <TeamTypingBubble names={typingNames || "الفريق"} /> : null}
          <div ref={endRef} />
        </div>
        <ApiErrorBanner errorAr={errorAr} />
        <Composer disabled={sending !== null} placeholder={PLACEHOLDERS[channel]} onSend={onSend} />
      </section>
    </div>
  );
}
