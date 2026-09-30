"use client";

import { useConnectionQualityIndicator } from "@livekit/components-react";
import { ConnectionQuality, type Participant } from "livekit-client";

const LABELS: Record<ConnectionQuality, { ar: string; en: string; tone: string }> = {
  [ConnectionQuality.Excellent]: { ar: "الاتصال ممتاز", en: "Excellent", tone: "good" },
  [ConnectionQuality.Good]: { ar: "الاتصال جيد", en: "Good", tone: "good" },
  [ConnectionQuality.Poor]: { ar: "الاتصال ضعيف — فعّل «صوت فقط»", en: "Poor — try audio only", tone: "poor" },
  [ConnectionQuality.Lost]: { ar: "انقطع الاتصال… نعيد المحاولة", en: "Reconnecting…", tone: "lost" },
  [ConnectionQuality.Unknown]: { ar: "جارٍ قياس الاتصال", en: "Measuring…", tone: "unknown" },
};

/** Local participant's network quality as reported by the LiveKit server. */
export function NetworkQualityBadge({ participant }: { participant?: Participant }) {
  const { quality } = useConnectionQualityIndicator({ participant });
  const label = LABELS[quality] ?? LABELS[ConnectionQuality.Unknown];
  return (
    <p className={`live-net-quality live-net-quality--${label.tone}`} role="status" aria-live="polite" dir="rtl">
      <span aria-hidden="true">●</span> {label.ar} <span dir="ltr">· {label.en}</span>
    </p>
  );
}
