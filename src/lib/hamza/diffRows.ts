/** Unified diff → rows for the unified and split views, plus unchanged gaps between hunks (pure). */

export type DiffLineKind = "add" | "del" | "ctx";
export type DiffLine = { kind: DiffLineKind; text: string; oldNo?: number; newNo?: number };
export type DiffHunk = { header: string; oldStart: number; oldCount: number; newStart: number; newCount: number; lines: DiffLine[] };
export type SplitRow = { left?: DiffLine; right?: DiffLine };
/** Unchanged lines before a hunk (old-file line range), collapsed by default. */
export type DiffGap = { fromOld: number; toOld: number; count: number };

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(text: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  for (const raw of text.split("\n")) {
    const header = raw.match(HUNK_RE);
    if (header) {
      oldNo = Number(header[1]);
      newNo = Number(header[3]);
      current = { header: raw, oldStart: oldNo, oldCount: Number(header[2] ?? 1), newStart: newNo, newCount: Number(header[4] ?? 1), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current || raw.startsWith("+++") || raw.startsWith("---")) continue;
    const mark = raw[0];
    const body = raw.slice(1);
    if (mark === "+") current.lines.push({ kind: "add", text: body, newNo: newNo++ });
    else if (mark === "-") current.lines.push({ kind: "del", text: body, oldNo: oldNo++ });
    else current.lines.push({ kind: "ctx", text: body, oldNo: oldNo++, newNo: newNo++ });
  }
  return hunks;
}

/** Pairs each block of deletions with the following additions (side by side), context on both sides. */
export function splitRows(hunk: DiffHunk): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < hunk.lines.length) {
    const line = hunk.lines[i];
    if (line.kind === "ctx") {
      rows.push({ left: line, right: line });
      i += 1;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < hunk.lines.length && hunk.lines[i].kind === "del") dels.push(hunk.lines[i++]);
    while (i < hunk.lines.length && hunk.lines[i].kind === "add") adds.push(hunk.lines[i++]);
    for (let k = 0; k < Math.max(dels.length, adds.length); k += 1) rows.push({ left: dels[k], right: adds[k] });
  }
  return rows;
}

/** Gap of unchanged old-file lines before hunk `index` (1-based line numbers, inclusive). */
export function gapBefore(hunks: DiffHunk[], index: number): DiffGap | null {
  const hunk = hunks[index];
  if (!hunk) return null;
  const prev = hunks[index - 1];
  const fromOld = prev ? prev.oldStart + prev.oldCount : 1;
  const toOld = hunk.oldStart - 1;
  const count = toOld - fromOld + 1;
  return count > 0 ? { fromOld, toOld, count } : null;
}

/** Context lines for an expanded gap (needs the old content). */
export function gapLines(oldContent: string, gap: DiffGap, newOffset: number): DiffLine[] {
  const lines = oldContent.split("\n");
  const out: DiffLine[] = [];
  for (let n = gap.fromOld; n <= gap.toOld; n += 1) out.push({ kind: "ctx", text: lines[n - 1] ?? "", oldNo: n, newNo: n + newOffset });
  return out;
}
