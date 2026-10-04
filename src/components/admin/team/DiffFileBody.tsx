"use client";

import { useMemo, useState } from "react";
import { useNs } from "@/components/i18n/useNs";
import { fmt } from "@/lib/i18n/format";
import { teamMessages } from "@/lib/i18n/ns/team";
import { gapBefore, gapLines, parseUnifiedDiff } from "@/lib/hamza/diffRows";
import type { TeamProposalFile } from "@/lib/team/types";
import { DiffHunkRows } from "./DiffHunkRows";

const COLLAPSE_ABOVE = 400;

/** One file's diff: hunks, collapsible unchanged regions between them, line numbers. */
export function DiffFileBody({ file, mode }: { file: TeamProposalFile; mode: "unified" | "split" }) {
  const d = useNs(teamMessages).hamza.diff;
  const hunks = useMemo(() => parseUnifiedDiff(file.diff), [file.diff]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState(file.additions + file.deletions <= COLLAPSE_ABOVE);
  if (!expanded) {
    return (
      <button type="button" className="btn ghost-btn team-diff-expand" onClick={() => setExpanded(true)}>
        {d.binaryHidden}
      </button>
    );
  }
  return (
    <div className={`team-diff-body is-${mode}`} dir="ltr">
      {file.change === "rename" && file.oldPath ? <p className="team-hint">{fmt(d.renamed, { from: file.oldPath })}</p> : null}
      {hunks.map((hunk, index) => {
        const gap = gapBefore(hunks, index);
        const canExpand = Boolean(gap && file.oldContent !== undefined);
        const extra = gap && open[index] && file.oldContent !== undefined ? gapLines(file.oldContent, gap, hunk.newStart - hunk.oldStart) : [];
        return (
          <div key={hunk.header + index}>
            {gap && canExpand && !open[index] ? (
              <button type="button" className="team-diff-gap" onClick={() => setOpen((current) => ({ ...current, [index]: true }))}>
                ⋯ {fmt(d.showAll, { n: gap.count })}
              </button>
            ) : null}
            <DiffHunkRows hunk={hunk} path={file.path} mode={mode} extra={extra} />
          </div>
        );
      })}
    </div>
  );
}
