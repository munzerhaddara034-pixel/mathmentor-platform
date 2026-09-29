/** Small Myers line diff → unified diff text (no dependency). */

type Op = { kind: " " | "-" | "+"; line: string };

function myers(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, a, b, offset, d);
    }
  }
  return [];
}

function backtrack(trace: Int32Array[], a: string[], b: string[], offset: number, dEnd: number): Op[] {
  const ops: Op[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = dEnd; d > 0; d -= 1) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? k + 1 : k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ kind: " ", line: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    if (x === prevX) ops.push({ kind: "+", line: b[y - 1] });
    else ops.push({ kind: "-", line: a[x - 1] });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    ops.push({ kind: " ", line: a[x - 1] });
    x -= 1;
    y -= 1;
  }
  return ops.reverse();
}

function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export type UnifiedDiff = { text: string; additions: number; deletions: number };

export function unifiedDiff(path: string, before: string | null, after: string, context = 3): UnifiedDiff {
  const a = splitLines(before ?? "");
  const b = splitLines(after);
  const ops = myers(a, b);
  let additions = 0;
  let deletions = 0;
  for (const op of ops) {
    if (op.kind === "+") additions += 1;
    if (op.kind === "-") deletions += 1;
  }
  const header = [`--- ${before === null ? "/dev/null" : `a/${path}`}`, `+++ b/${path}`];
  const hunks: string[] = [];
  let i = 0;
  let aLine = 1;
  let bLine = 1;
  const positions: Array<{ a: number; b: number }> = [];
  for (const op of ops) {
    positions.push({ a: aLine, b: bLine });
    if (op.kind !== "+") aLine += 1;
    if (op.kind !== "-") bLine += 1;
  }
  while (i < ops.length) {
    if (ops[i].kind === " ") {
      i += 1;
      continue;
    }
    const start = Math.max(0, i - context);
    let end = i;
    let lastChange = i;
    while (end < ops.length) {
      if (ops[end].kind !== " ") lastChange = end;
      else if (end - lastChange > context * 2) break;
      end += 1;
    }
    end = Math.min(ops.length, lastChange + context + 1);
    const slice = ops.slice(start, end);
    const aCount = slice.filter((op) => op.kind !== "+").length;
    const bCount = slice.filter((op) => op.kind !== "-").length;
    const aStart = aCount ? positions[start].a : positions[start].a - 1;
    const bStart = bCount ? positions[start].b : positions[start].b - 1;
    hunks.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const op of slice) hunks.push(`${op.kind}${op.line}`);
    i = end;
  }
  return { text: [...header, ...hunks].join("\n"), additions, deletions };
}
