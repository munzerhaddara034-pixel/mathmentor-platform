import { test } from "node:test";
import assert from "node:assert/strict";
import { gapBefore, gapLines, parseUnifiedDiff, splitRows } from "../src/lib/hamza/diffRows.ts";
import { highlightLine } from "../src/lib/hamza/highlight.ts";
import { unifiedDiff } from "../src/lib/team/diff.ts";
import { timelineChips } from "../src/lib/hamza/timeline.ts";

const before = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
const after = before.replace("line 3\n", "LINE 3\n").replace("line 25\n", "line 25\nadded\n");

test("unified diff parses into numbered lines; gaps between hunks are computed and expandable", () => {
  const d = unifiedDiff("src/x.ts", before, after);
  const hunks = parseUnifiedDiff(d.text);
  assert.equal(hunks.length, 2);
  const del = hunks[0].lines.find((l) => l.kind === "del");
  const add = hunks[0].lines.find((l) => l.kind === "add");
  assert.deepEqual([del.oldNo, del.text, add.newNo, add.text], [3, "line 3", 3, "LINE 3"]);
  const gap = gapBefore(hunks, 1);
  assert.ok(gap && gap.count > 0 && gap.fromOld === hunks[0].oldStart + hunks[0].oldCount);
  const lines = gapLines(before, gap, 0);
  assert.equal(lines.length, gap.count);
  assert.equal(lines[0].text, `line ${gap.fromOld}`);
  assert.equal(gapBefore(hunks, 0), null, "first hunk starts at line 1");
});

test("split rows pair deletions with additions; context on both sides", () => {
  const hunks = parseUnifiedDiff(unifiedDiff("a.ts", "a\nb\nc\n", "a\nB\nB2\nc\n").text);
  const rows = splitRows(hunks[0]);
  assert.deepEqual(
    rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null]),
    [["a", "a"], ["b", "B"], [null, "B2"], ["c", "c"]],
  );
});

test("highlighter tokenises keywords, strings, comments, numbers; markdown stays plain", () => {
  const tokens = highlightLine('export const n = 42; // answer "x"', "src/a.ts");
  assert.deepEqual(tokens.filter((t) => t.kind !== "plain").map((t) => [t.kind, t.text]), [["kw", "export"], ["kw", "const"], ["num", "42"], ["com", '// answer "x"']]);
  assert.equal(highlightLine("const x = 1", "README.md")[0].kind, "plain");
  assert.equal(highlightLine("color: #fff;", "a.css").some((t) => t.kind === "com"), false);
  assert.equal(highlightLine('a = "s"', "a.ts").find((t) => t.kind === "str").text, '"s"');
});

test("timeline chips: proposed → approved (PR) → CI → merged → deployed / reverted", () => {
  const state = { prNumber: 7, timeline: [], codes: {}, revision: 1, diffHash: "", tier: "standard", riskLevel: "low", repairRounds: 0 };
  const states = (status, s = state) => timelineChips(status, s).map((c) => c.state);
  assert.deepEqual(states("pending"), ["done", "active", "todo", "todo", "todo"]);
  assert.deepEqual(states("ci_running"), ["done", "done", "active", "todo", "todo"]);
  assert.deepEqual(states("ci_failed"), ["done", "done", "failed", "todo", "todo"]);
  assert.deepEqual(states("ci_passed"), ["done", "done", "done", "active", "todo"]);
  assert.deepEqual(states("merged"), ["done", "done", "done", "done", "done"]);
  assert.deepEqual(states("merged", { ...state, reverted: true }).at(-1), "reverted");
  assert.equal(timelineChips("ci_running", state)[1].prNumber, 7);
});
