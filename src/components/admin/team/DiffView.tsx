"use client";

import { useEffect, useState } from "react";
import { useNs } from "@/components/i18n/useNs";
import { teamMessages } from "@/lib/i18n/ns/team";
import type { TeamProposalFile } from "@/lib/team/types";
import { DiffFileBody } from "./DiffFileBody";
import { DiffFileTabs } from "./DiffFileTabs";

type Mode = "unified" | "split";

/** Multi-file diff preview: file tabs, unified/split toggle (unified by default on phones), LTR code. */
export function DiffView({ files }: { files: TeamProposalFile[] }) {
  const d = useNs(teamMessages).hamza.diff;
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>("unified");

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(min-width: 900px)").matches) setMode("split");
  }, []);

  const file = files[Math.min(selected, files.length - 1)];
  if (!file) return null;
  return (
    <div className="team-diff-view">
      <div className="team-diff-toolbar">
        {files.length > 1 ? <DiffFileTabs files={files} selected={selected} onSelect={setSelected} /> : null}
        <div className="team-diff-modes" role="group">
          {(["unified", "split"] as const).map((value) => (
            <button key={value} type="button" className={`team-diff-mode${mode === value ? " is-active" : ""}`} aria-pressed={mode === value} onClick={() => setMode(value)}>
              {d[value]}
            </button>
          ))}
        </div>
      </div>
      <p className="team-diff-path" dir="ltr">
        <code>{file.change === "rename" && file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}</code>{" "}
        <span className="team-add">+{file.additions}</span> <span className="team-del">−{file.deletions}</span>
      </p>
      <DiffFileBody key={`${file.path}-${mode}`} file={file} mode={mode} />
    </div>
  );
}
