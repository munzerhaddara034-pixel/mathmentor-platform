"use client";

import type { DiffHunk, DiffLine } from "@/lib/hamza/diffRows";
import { splitRows } from "@/lib/hamza/diffRows";
import { DiffCode } from "./DiffCode";

type Props = { hunk: DiffHunk; path: string; mode: "unified" | "split"; extra?: DiffLine[] };

function Num({ value }: { value?: number }) {
  return <span className="team-diff-num">{value ?? ""}</span>;
}

/** One hunk (with optional expanded context before it) in unified or split layout. */
export function DiffHunkRows({ hunk, path, mode, extra = [] }: Props) {
  const lines = [...extra, ...hunk.lines];
  if (mode === "unified") {
    return (
      <>
        <div className="team-diff-row is-hunk">{hunk.header}</div>
        {lines.map((line, index) => (
          <div key={index} className={`team-diff-row is-${line.kind}`}>
            <Num value={line.oldNo} />
            <Num value={line.newNo} />
            <span className="team-diff-mark">{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>
            <DiffCode text={line.text} path={path} />
          </div>
        ))}
      </>
    );
  }
  const rows = [...extra.map((line) => ({ left: line, right: line })), ...splitRows(hunk)];
  return (
    <>
      <div className="team-diff-row is-hunk">{hunk.header}</div>
      {rows.map((row, index) => (
        <div key={index} className="team-diff-split">
          <div className={`team-diff-row is-${row.left ? (row.left.kind === "add" ? "ctx" : row.left.kind) : "empty"}`}>
            <Num value={row.left?.oldNo} />
            {row.left ? <DiffCode text={row.left.text} path={path} /> : null}
          </div>
          <div className={`team-diff-row is-${row.right ? (row.right.kind === "del" ? "ctx" : row.right.kind) : "empty"}`}>
            <Num value={row.right?.newNo} />
            {row.right ? <DiffCode text={row.right.text} path={path} /> : null}
          </div>
        </div>
      ))}
    </>
  );
}
