"use client";

import type { TeamProposalFile } from "@/lib/team/types";
import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";

/** Unified diff with +/- colouring (LTR code inside the RTL chat). */
export function DiffView({ file }: { file: TeamProposalFile }) {
  const t = useNs(teamMessages);
  const lines = file.diff.split("\n");
  return (
    <details className="team-diff-file" open={file.additions + file.deletions < 80}>
      <summary dir="ltr">
        <code>{file.path}</code> {file.isNew ? <span className="team-badge">{t.diffNew}</span> : null}{" "}
        <span className="team-add">+{file.additions}</span> <span className="team-del">−{file.deletions}</span>
      </summary>
      <pre className="team-diff" dir="ltr">
        {lines.map((line, index) => {
          const kind = line.startsWith("@@")
            ? "hunk"
            : line.startsWith("+++") || line.startsWith("---")
              ? "meta"
              : line.startsWith("+")
                ? "add"
                : line.startsWith("-")
                  ? "del"
                  : "ctx";
          return (
            <span key={index} className={`team-diff-line is-${kind}`}>
              {line || " "}
              {"\n"}
            </span>
          );
        })}
      </pre>
    </details>
  );
}
