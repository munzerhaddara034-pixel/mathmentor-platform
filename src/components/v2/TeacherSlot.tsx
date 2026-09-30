import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { fmt } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages/en";
import type { TeacherLiveStatus } from "@/lib/live/teacherLiveStatus";

/** Photo used when the teacher is offline (enhanced 16:9 portrait; 480w variant for compact slots). */
export const TEACHER_PHOTO = { full: "/teachers/munzer-slot.webp", compact: "/teachers/munzer-slot-480w.webp" } as const;
const LIVE_POSTER = "/teachers/munzer-live-poster.webp";

export type TeacherSlotProps = {
  status: TeacherLiveStatus;
  t: Messages["teacherSlot"];
  variant?: "full" | "compact";
  /** Quiet line under the photo when offline, e.g. "next available Tomorrow 16:00" (real data only). */
  offlineNote?: string | null;
  /** Future LiveKit 180p muted preview (mounted only after the visitor taps and never under data-saver). */
  preview?: ReactNode;
};

/**
 * Teacher slot: one 16:9 box for every state (CLS 0).
 * LIVE → red pulsing ring, «مباشر الآن» badge, viewers (when known), title, caption, red join button; the whole
 * box links to the room. Data-saver → still frame + play affordance, no video. OFF → photo + quiet status note.
 * Pure markup (server-safe); the polling wrapper lives in TeacherSlotLive.
 */
export function TeacherSlotView({ status, t, variant = "full", offlineNote, preview }: TeacherSlotProps) {
  const compact = variant === "compact";
  if (status.state === "live") {
    return (
      <div className="v2-tslot-wrap">
        <Link href={status.roomHref} className={`v2-tslot is-live${compact ? " is-compact" : ""}`} aria-label={t.liveAria}>
          <img src={status.posterUrl ?? LIVE_POSTER} alt="" width={1280} height={720} loading="lazy" decoding="async" />
          {preview ? <div className="v2-tslot-preview">{preview}</div> : null}
          <span className="scrim" />
          <span className="tl">
            <span className="v2-badge-live">
              <i />
              {compact ? t.liveShort : t.live}
            </span>
            {status.viewers !== null ? <span className="v2-vchip">{fmt(t.viewers, { n: status.viewers })}</span> : null}
          </span>
          {preview ? null : (
            <span className="v2-poster-play" aria-hidden="true">
              <Icon name="play" size={22} filled />
            </span>
          )}
          {compact ? null : (
            <span className="bl">
              <span>
                {status.title ? <b>{status.title}</b> : null}
                <small className="v2-cap-preview">{preview ? t.captionPreview : t.captionPoster}</small>
                <small className="v2-cap-saver">{t.captionSaver}</small>
              </span>
            </span>
          )}
        </Link>
        {compact ? null : (
          <Link href={status.roomHref} className="v2-btn v2-btn-live v2-btn-block">
            <Icon name="video" size={18} /> {t.join}
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="v2-tslot-wrap">
      <div className={`v2-tslot${compact ? " is-compact" : ""}`}>
        <img
          className="photo"
          src={compact ? TEACHER_PHOTO.compact : TEACHER_PHOTO.full}
          srcSet={`${TEACHER_PHOTO.compact} 480w, ${TEACHER_PHOTO.full} 960w`}
          sizes={compact ? "240px" : "(min-width: 960px) 520px, 100vw"}
          alt={t.photoAlt}
          width={960}
          height={540}
          loading="lazy"
          decoding="async"
        />
      </div>
      <p className="v2-offnote">
        <span className="d" aria-hidden="true" />
        <span>
          {t.offline}
          {offlineNote ? ` · ${offlineNote}` : ""}
        </span>
      </p>
    </div>
  );
}
