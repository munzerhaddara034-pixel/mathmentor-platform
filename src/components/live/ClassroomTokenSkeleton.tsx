import { Skeleton, SkeletonBlock } from "@/components/ui/Skeleton";

/** Loading UI while POST /api/livekit/token is in flight. */
export function ClassroomTokenSkeleton() {
  return (
    <main className="shell live-classroom-loading mm-mobile-stack">
      <p className="eyebrow">صف مباشر · LiveKit</p>
      <h1>جارٍ تجهيز الحصة… / Preparing classroom…</h1>
      <p className="muted">Fetching secure token · جلب رمز الدخول الآمن</p>
      <div className="live-classroom-skeleton" aria-busy="true">
        <SkeletonBlock lines={4} label="Loading LiveKit token" />
        <div className="live-classroom-skeleton-grid">
          <Skeleton height={220} label="Whiteboard skeleton" rounded="lg" />
          <div className="live-classroom-skeleton-side">
            <Skeleton height={120} rounded="lg" label="Video skeleton" />
            <Skeleton height={88} rounded="lg" label="Roster skeleton" />
            <Skeleton height={100} rounded="lg" label="Chat skeleton" />
          </div>
        </div>
      </div>
    </main>
  );
}
