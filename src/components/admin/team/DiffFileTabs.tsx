"use client";

import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamProposalFile } from "@/lib/team/types";

type Props = { files: TeamProposalFile[]; selected: number; onSelect: (index: number) => void };

/** Changed-files list: one tap target per file (scrolls horizontally on phones). */
export function DiffFileTabs({ files, selected, onSelect }: Props) {
  const t = useNs(teamMessages);
  const d = t.hamza.diff;
  return (
    <div className="team-diff-tabs" role="tablist" aria-label={d.files} dir="ltr">
      {files.map((file, index) => (
        <button
          key={`${file.oldPath ?? ""}${file.path}`}
          type="button"
          role="tab"
          aria-selected={index === selected}
          className={`team-diff-tab${index === selected ? " is-active" : ""}`}
          onClick={() => onSelect(index)}
        >
          <code>{file.path.split("/").pop()}</code>
          {file.change === "delete" ? <span className="team-badge">{d.deleted}</span> : null}
          {file.isNew || file.change === "add" ? <span className="team-badge">{t.diffNew}</span> : null}
          {file.change === "rename" ? <span className="team-badge">↪</span> : null}
          <span className="team-add">+{file.additions}</span>
          <span className="team-del">−{file.deletions}</span>
        </button>
      ))}
    </div>
  );
}
