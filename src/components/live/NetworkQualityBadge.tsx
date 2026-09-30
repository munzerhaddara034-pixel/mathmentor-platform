"use client";

import { useConnectionQualityIndicator } from "@livekit/components-react";
import { ConnectionQuality, type Participant } from "livekit-client";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

const LABELS: Record<ConnectionQuality, { key: "excellent" | "good" | "poor" | "lost" | "unknown"; tone: string }> = {
  [ConnectionQuality.Excellent]: { key: "excellent", tone: "good" },
  [ConnectionQuality.Good]: { key: "good", tone: "good" },
  [ConnectionQuality.Poor]: { key: "poor", tone: "poor" },
  [ConnectionQuality.Lost]: { key: "lost", tone: "lost" },
  [ConnectionQuality.Unknown]: { key: "unknown", tone: "unknown" },
};

/** Local participant's network quality as reported by the LiveKit server. */
export function NetworkQualityBadge({ participant }: { participant?: Participant }) {
  const t = useNs(liveMessages).room.quality;
  const { quality } = useConnectionQualityIndicator({ participant });
  const label = LABELS[quality] ?? LABELS[ConnectionQuality.Unknown];
  return (
    <p className={`live-net-quality live-net-quality--${label.tone}`} role="status" aria-live="polite">
      <span aria-hidden="true">●</span> {t[label.key]}
    </p>
  );
}
