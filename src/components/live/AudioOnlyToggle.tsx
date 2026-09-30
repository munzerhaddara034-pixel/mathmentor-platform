"use client";

import { useNs } from "@/components/i18n/useNs";
import { liveMessages } from "@/lib/i18n/ns/live";

/** "Audio only / data saver": no camera publish, no remote camera download. */
export function AudioOnlyToggle({ audioOnly, onChange }: { audioOnly: boolean; onChange: (next: boolean) => void }) {
  const t = useNs(liveMessages).room;
  return (
    <label className="live-audio-only">
      <input type="checkbox" checked={audioOnly} onChange={(event) => onChange(event.target.checked)} />
      <span>{t.audioOnly}</span>
    </label>
  );
}
