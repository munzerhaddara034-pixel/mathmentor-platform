"use client";

import { TEAM_CHANNELS, type TeamChannelId } from "@/lib/team/types";

type Props = {
  active: TeamChannelId;
  unread: Partial<Record<TeamChannelId, number>>;
  onSelect: (channel: TeamChannelId) => void;
};

/** RTL channel list: horizontal chips on mobile, sidebar on ≥ 900px. */
export function ChannelList({ active, unread, onSelect }: Props) {
  return (
    <nav className="team-channels" aria-label="قنوات الفريق">
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
              <span className="team-channel-name">{channel.labelAr}</span>
              <span className="team-channel-sub">{channel.subtitleAr}</span>
            </span>
            {count > 0 ? <span className="team-unread">{count}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}
