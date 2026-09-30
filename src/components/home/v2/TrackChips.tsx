import type { Messages } from "@/lib/i18n/messages/en";

const ORDER = ["lebanese", "ib", "cambridge", "sat", "ap", "gcc"] as const;

export function TrackChips({ t }: { t: Messages["home"] }) {
  return (
    <ul className="v2-tracks" aria-label={t.curricula}>
      {ORDER.map((key) => (
        <li key={key} className="v2-chip">
          {t.tracks[key]}
        </li>
      ))}
    </ul>
  );
}
