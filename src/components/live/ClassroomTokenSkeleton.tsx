"use client";

import { Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";
import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

/** Loading UI while POST /api/livekit/token is in flight. */
export function ClassroomTokenSkeleton() {
  const t = useNs(liveMessages).room;
  return (
    <main className="shell live-classroom-loading mm-mobile-stack">
      <p className="eyebrow">{t.eyebrow} · LiveKit</p>
      <h1>{t.preparing}</h1>
      <p className="muted">{t.fetchingToken}</p>
      <div className="live-classroom-skeleton" aria-busy="true">
        <SkeletonBlock lines={4} label={t.fetchingToken} />
        <div className="live-classroom-skeleton-grid">
          <Skeleton height={220} label={t.preparing} rounded="lg" />
          <div className="live-classroom-skeleton-side">
            <Skeleton height={120} rounded="lg" label={t.video} />
            <Skeleton height={88} rounded="lg" label={t.participants} />
            <Skeleton height={100} rounded="lg" label={t.chat} />
          </div>
        </div>
      </div>
    </main>
  );
}
