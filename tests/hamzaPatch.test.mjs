import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdits, applyPatch, parsePatchOps } from "../src/lib/hamza/patch.ts";
import { treeWrites } from "../src/lib/hamza/pipeline/shared.ts";
import { memorySnapshot } from "../src/lib/hamza/snapshot.ts";
import { gitBlobSha } from "./support/fakeGithub.mjs";

const base = {
  "src/a.ts": "export const a = 1;\nexport const b = 2;\n",
  "src/old/Card.tsx": "export function Card() {\n  return null;\n}\n",
  "docs/x.md": "# x\n",
};
const snap = memorySnapshot(base, { sha: "b".repeat(40), shaOf: gitBlobSha });

test("parsePatchOps keeps valid ops only", () => {
  const ops = parsePatchOps([
    { op: "edit", path: "/src/a.ts", edits: [{ search: "1", replace: "3" }, { search: 1 }] },
    { op: "create", path: "src/n.ts", content: "x" },
    { op: "delete", path: "docs/x.md" },
    { op: "rename", from: "src/old/Card.tsx", to: "src/new/Card.tsx" },
    { op: "chmod", path: "src/a.ts" },
    "junk",
  ]);
  assert.deepEqual(ops.map((op) => op.op), ["edit", "create", "delete", "rename"]);
  assert.equal(ops[0].path, "src/a.ts");
  assert.equal(ops[0].edits.length, 1);
});

test("edit: exact single match required", () => {
  assert.deepEqual(applyEdits("f", "x\nx\n", [{ search: "x", replace: "y" }]).errors.length, 1);
  assert.equal(applyEdits("f", "a $& b\n", [{ search: "a", replace: "$&$&" }]).content, "$&$& $& b\n", "replace is literal");
  assert.match(applyEdits("f", "a\n", [{ search: "zz", replace: "y" }]).errors[0], /matched 0 times/);
});

test("multi-file patch: modify + add + delete + rename with real blob shas and old content", async () => {
  const result = await applyPatch(snap, [
    { op: "edit", path: "src/a.ts", edits: [{ search: "export const b = 2;", replace: "export const b = 3;" }] },
    { op: "create", path: "src/components/New.tsx", content: "export function New() {\n  return null;\n}" },
    { op: "delete", path: "docs/x.md" },
    { op: "rename", from: "src/old/Card.tsx", to: "src/new/Card.tsx", edits: [{ search: "null", replace: "<div />" }] },
  ]);
  assert.equal(result.ok, true);
  const byPath = Object.fromEntries(result.files.map((f) => [f.path, f]));
  assert.equal(byPath["src/a.ts"].change, "modify");
  assert.equal(byPath["src/a.ts"].baseSha, gitBlobSha(base["src/a.ts"]));
  assert.equal(byPath["src/a.ts"].oldContent, base["src/a.ts"]);
  assert.deepEqual([byPath["src/a.ts"].additions, byPath["src/a.ts"].deletions], [1, 1]);
  assert.equal(byPath["src/components/New.tsx"].isNew, true);
  assert.ok(byPath["src/components/New.tsx"].newContent.endsWith("}\n"));
  assert.equal(byPath["docs/x.md"].change, "delete");
  assert.equal(byPath["docs/x.md"].newContent, "");
  assert.equal(byPath["src/new/Card.tsx"].oldPath, "src/old/Card.tsx");
  assert.equal(byPath["src/new/Card.tsx"].baseSha, gitBlobSha(base["src/old/Card.tsx"]));
  assert.deepEqual(treeWrites(result.files).map((w) => `${w.content === null ? "D" : "W"} ${w.path}`), [
    "W src/a.ts",
    "W src/components/New.tsx",
    "D docs/x.md",
    "D src/old/Card.tsx",
    "W src/new/Card.tsx",
  ]);
});

test("rejects forbidden paths, duplicates, missing files, existing targets and no-op patches", async () => {
  const bad = await applyPatch(snap, [
    { op: "create", path: ".github/workflows/x.yml", content: "x" },
    { op: "create", path: "src/a.ts", content: "x" },
    { op: "edit", path: "src/missing.ts", edits: [{ search: "a", replace: "b" }] },
    { op: "rename", from: "src/old/Card.tsx", to: "docs/x.md", edits: [] },
  ]);
  assert.equal(bad.ok, false);
  const text = bad.errors.join("\n");
  assert.match(text, /\.github.*not writable/);
  assert.match(text, /src\/a\.ts: already exists/);
  assert.match(text, /src\/missing\.ts: not found/);
  assert.match(text, /rename target already exists/);
  const noop = await applyPatch(snap, [{ op: "edit", path: "src/a.ts", edits: [{ search: "a = 1", replace: "a = 1" }] }]);
  assert.match(noop.errors[0], /changes nothing/);
  assert.match((await applyPatch(snap, [])).errors[0], /empty/);
});
