"use client";

import { TEAM_CHANNELS, type TeamChannelId } from "@/lib/team/types";
import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";

type Props = {
  active: TeamChannelId;
  unread: Partial<Record<TeamChannelId, number>>;
  onSelect: (channel: TeamChannelId) => void;
};

/** Channel list: horizontal chips on mobile, sidebar on ≥ 900px (logical properties, RTL-aware). */
export function ChannelList({ active, unread, onSelect }: Props) {
  const t = useNs(teamMessages);
  return (
    <nav className="team-channels" aria-label={t.channelsLabel}>
      {TEAM_CHANNELS.map((channel) => {
        const count = unread[channel.id] ?? 0;
        return (
          <button
            key={channel.id}
            type="button"
            className={`team-channel${channel.id === active ? " is-active" : ""}`}
            aria-current={channel.id === active ? "page" : undefined}
            onClick={() => onSelect(channel.id)}
          >
            <span className={`team-avatar team-avatar-${channel.id}`} aria-hidden>
              {channel.avatar}
            </span>
            <span className="team-channel-text">
              <span className="team-channel-name">{t.channels[channel.id].label}</span>
              <span className="team-channel-sub">{t.channels[channel.id].subtitle}</span>
            </span>
            {count > 0 ? <span className="team-unread">{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
