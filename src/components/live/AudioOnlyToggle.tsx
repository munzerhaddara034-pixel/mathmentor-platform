"use client";

/** «صوت فقط / توفير الإنترنت»: no camera publish, no remote camera download. */
export function AudioOnlyToggle({ audioOnly, onChange }: { audioOnly: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="live-audio-only" dir="rtl">
      <input type="checkbox" checked={audioOnly} onChange={(event) => onChange(event.target.checked)} />
      <span>صوت فقط / توفير الإنترنت</span>
      <span className="muted" dir="ltr">
        · Audio only (data saver)
      </span>
    </label>
  );
}
