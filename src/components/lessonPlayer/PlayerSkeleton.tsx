/** Shimmer placeholder for the 16:9 frame + control bar (static under prefers-reduced-motion, see lessonPlayer.css). */
export function PlayerSkeleton({ label, poster }: { label: string; poster?: string }) {
  return (
    <div className="lp-skeleton" role="status" aria-live="polite" aria-busy="true">
      {poster ? (
        <img className="lp-skeleton-poster" src={poster} alt="" loading="lazy" decoding="async" />
      ) : null}
      <div className="lp-shimmer" aria-hidden="true" />
      <div className="lp-skeleton-bar" aria-hidden="true">
        <span className="lp-skel-dot" />
        <span className="lp-skel-line" />
        <span className="lp-skel-dot" />
        <span className="lp-skel-dot" />
      </div>
      <span className="lp-sr">{label}</span>
    </div>
  );
}
