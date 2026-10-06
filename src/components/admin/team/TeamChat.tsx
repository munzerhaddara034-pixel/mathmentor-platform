"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiErrorBanner } from "@/components/ui/Skeleton";
import { routeHumanMessage } from "@/lib/team/routing";
import {
  TEAM_CHANNELS,
  teamAuthorDisplayName,
  type TeamChannelId,
  type TeamMessage,
  type TeamProposal,
} from "@/lib/team/types";
import { ChannelList } from "./ChannelList";
import { Composer } from "./Composer";
import { MessageBubble } from "./MessageBubble";
import { HamzaActivityPanel } from "./HamzaActivityPanel";
import { TeamThreadSkeleton, TeamTypingBubble } from "./TeamChatSkeleton";
import { fetchThread, sendTeamMessage, teamErrorText } from "./teamApi";
import { EMPTY_THREAD as EMPTY, hasActiveWork, indexById, taskCardOwners, threadFrom, type Thread } from "./threadState";
import { useThreadPolling } from "./useThreadPolling";
import type { PublicHamzaTask } from "@/lib/hamza/tasks/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";

/** Messenger-style team chat for staff (follows the site locale; RTL in ar, mobile-first). */
export function TeamChat({ staffName }: { staffName: string }) {
  const { locale } = useI18n();
  const t = teamMessages[locale];
  const [channel, setChannel] = useState<TeamChannelId>("team");
  const [threads, setThreads] = useState<Partial<Record<TeamChannelId, Thread>>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<TeamChannelId | null>(null);
  const [typingNames, setTypingNames] = useState("");
  const [errorText, setErrorText] = useState("");
  const [storage, setStorage] = useState<"postgres" | "file" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = threads[channel] ?? EMPTY;
  const meta = TEAM_CHANNELS.find((item) => item.id === channel) ?? TEAM_CHANNELS[0];

  const load = useCallback(async (target: TeamChannelId, silent = false) => {
    if (!silent) {
      setLoading(true);
      setErrorText("");
    }
    const result = await fetchThread(target);
    if (!silent) setLoading(false);
    if (!result.ok) {
      if (!silent) setErrorText(teamErrorText(result, locale, t));
      return;
    }
    setStorage(result.data.storage);
    setThreads((current) => ({ ...current, [target]: threadFrom(result.data) }));
  }, [locale, t]);
  const refresh = useCallback(() => void load(channel, true), [channel, load]);
  useThreadPolling(hasActiveWork(thread), refresh);
  const owners = useMemo(() => taskCardOwners(thread.messages), [thread.messages]);

  useEffect(() => {
    void load(channel);
  }, [channel, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread.messages.length, sending]);

  const referredNames = useMemo(() => {
    const byId = new Map(thread.messages.map((message) => [message.id, teamAuthorDisplayName(message, t.agents)]));
    return (message: TeamMessage) => (message.referredById ? byId.get(message.referredById) : undefined);
  }, [thread.messages, t]);

  const onSend = async (text: string, files: File[]) => {
    const target = channel;
    const route = routeHumanMessage(target, text);
    setTypingNames(route.responders.map((agent) => t.agents[agent]).join(t.and));
    setSending(target);
    setErrorText("");
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
      setErrorText(teamErrorText(result, locale, t));
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
          ...base,
          loaded: true,
          messages: [...base.messages.filter((m) => m.id !== optimistic.id), message, ...replies],
          proposals: { ...base.proposals, ...indexById(proposals) },
        },
      };
    });
    if (replies.some((reply) => reply.taskId)) void load(target, true);
    return true;
  };

  const onDecided = useCallback((proposal: TeamProposal, message?: TeamMessage) => {
    setThreads((current) => {
      const base = current[proposal.channel] ?? EMPTY;
      const known = message ? base.messages.some((item) => item.id === message.id) : true;
      return {
        ...current,
        [proposal.channel]: {
          ...base,
          messages: message && !known ? [...base.messages, message] : base.messages,
          proposals: { ...base.proposals, [proposal.id]: proposal },
        },
      };
    });
    // Revisions queue a task and reverts update the original card: reload quietly.
    if (message?.taskId || proposal.hamza?.revertOf) void load(proposal.channel, true);
  }, [load]);

  const onTaskUpdated = useCallback((task: PublicHamzaTask) => {
    setThreads((current) => {
      const base = current[task.channel] ?? EMPTY;
      return { ...current, [task.channel]: { ...base, tasks: { ...base.tasks, [task.id]: task } } };
    });
  }, []);

  return (
    <div className="team-chat">
      <ChannelList active={channel} unread={{}} onSelect={setChannel} />
      <section className="team-thread" aria-label={fmt(t.conversation, { name: t.channels[meta.id].label })}>
        <header className="team-thread-head">
          <span className={`team-avatar team-avatar-${meta.id}`} aria-hidden>
            {meta.avatar}
          </span>
          <div>
            <h2>{t.channels[meta.id].label}</h2>
            <p className="muted">{t.channels[meta.id].subtitle}</p>
          </div>
          {storage ? (
            <span className={`team-storage is-${storage}`} title={t.storageTitle}>
              {storage === "postgres" ? t.storagePostgres : t.storageFile}
            </span>
          ) : null}
        </header>
        {channel === "developer" ? <HamzaActivityPanel /> : null}
        <div className="team-messages" aria-live="polite">
          {loading && !thread.loaded ? <TeamThreadSkeleton /> : null}
          {thread.loaded && !thread.messages.length ? (
            <p className="team-empty">{t.empty}</p>
          ) : null}
          {thread.messages.map((message) => {
            const proposal = message.proposalId ? thread.proposals[message.proposalId] : undefined;
            return (
              <MessageBubble
                key={message.id}
                message={message}
                proposal={proposal && proposal.messageId === message.id ? proposal : undefined}
                task={message.taskId && owners.get(message.taskId) === message.id ? thread.tasks[message.taskId] : undefined}
                referredByName={referredNames(message)}
                onDecided={onDecided}
                onTaskUpdated={onTaskUpdated}
              />
            );
          })}
          {sending === channel ? <TeamTypingBubble names={typingNames || t.teamTyping} /> : null}
          <div ref={endRef} />
        </div>
        <ApiErrorBanner error={errorText} errorAr={errorText} />
        <Composer disabled={sending !== null} placeholder={t.placeholders[channel]} onSend={onSend} />
      </section>
    </div>
  );
}
