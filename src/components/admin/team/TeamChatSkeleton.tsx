import { Skeleton } from "@/components/ui/Skeleton";

/** Loading placeholder for a thread (alternating bubbles). */
export function TeamThreadSkeleton() {
  return (
    <div className="team-thread-skeleton" aria-busy="true" aria-label="جارٍ تحميل الرسائل">
      {[72, 55, 80, 46].map((width, index) => (
        <div key={index} className={`team-skel-row ${index % 2 ? "is-agent" : "is-human"}`}>
          <Skeleton height={index % 2 ? 64 : 40} width={`${width}%`} rounded="lg" label="" />
        </div>
      ))}
    </div>
  );
}

/** Typing indicator while agents answer. */
export function TeamTypingBubble({ names }: { names: string }) {
  return (
    <div className="team-row is-agent" role="status" aria-live="polite">
      <div className="team-bubble is-typing">
        <span className="team-typing-dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="team-typing-label">{names} يكتب…</span>
        <Skeleton height={12} width="70%" label="" />
      </div>
    </div>
  );
}
