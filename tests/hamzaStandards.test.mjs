import { test } from "node:test";
import assert from "node:assert/strict";
import { addedLineNumbers, checkStandards, formatFindings, functionSpans, standardsErrors, standardsInput } from "../src/lib/hamza/standards.ts";
import { unifiedDiff } from "../src/lib/team/diff.ts";

function newFile(path, content) {
  return { path, content, addedLines: content.split("\n").map((_, i) => i + 1), isNew: true };
}
const rules = (files) => checkStandards(files).map((f) => `${f.severity}:${f.rule}`);

test("addedLineNumbers follows hunk headers", () => {
  const d = unifiedDiff("a.ts", "a\nb\nc\nd\n", "a\nB\nc\nd\ne\n");
  assert.deepEqual(addedLineNumbers(d.text), [2, 5]);
});

test("no-any / ts-ignore on added lines only", () => {
  assert.deepEqual(rules([newFile("src/a.ts", "export const x: any = 1;\n")]), ["error:no-any"]);
  assert.deepEqual(rules([newFile("src/a.ts", "// @ts-ignore\nconst y = 1;\n")]), ["error:no-any"]);
  assert.deepEqual(rules([{ path: "src/a.ts", content: "const x: any = 1;\nconst company = 2;\n", addedLines: [2], isNew: false }]), []);
  assert.deepEqual(rules([newFile("docs/a.md", "x: any\n")]), []);
});

test("small components: new >200 lines is an error, growing an old one is a warning", () => {
  const big = `${Array.from({ length: 210 }, (_, i) => `const v${i} = ${i};`).join("\n")}\n`;
  assert.ok(rules([newFile("src/components/Big.tsx", big)]).includes("error:small-components"));
  assert.ok(rules([{ path: "src/components/Big.tsx", content: big, addedLines: [3], isNew: false }]).includes("warn:small-components"));
  assert.ok(!rules([newFile("src/lib/big.ts", big)]).includes("error:small-components"));
});

test("functions > 60 lines warn", () => {
  const body = Array.from({ length: 70 }, () => "  x += 1;").join("\n");
  const content = `export function long() {\n  let x = 0;\n${body}\n  return x;\n}\n\nconst short = () => {\n  return 1;\n};\n`;
  const spans = functionSpans(content);
  assert.deepEqual(spans.map((s) => s.name), ["long", "short"]);
  assert.deepEqual(rules([newFile("src/lib/f.ts", content)]), ["warn:small-functions"]);
});

test("client fetch needs try/catch and a skeleton", () => {
  const bad = '"use client";\nexport function A() {\n  void fetch("/api/x");\n  return null;\n}\n';
  assert.deepEqual(rules([newFile("src/components/A.tsx", bad)]), ["error:fetch-try-catch", "error:fetch-skeleton"]);
  const good = '"use client";\nimport { Skeleton } from "@/components/ui/Skeleton";\nexport function A() {\n  try {\n    void fetch("/api/x");\n  } catch {\n    return null;\n  }\n  return <Skeleton />;\n}\n';
  assert.deepEqual(rules([newFile("src/components/A.tsx", good)]), []);
});

test("raw $…$ maths, wide fixed widths, secrets, brand", () => {
  assert.deepEqual(rules([newFile("src/components/M.tsx", "export const M = () => <p>Solve $x^2 = 4$</p>;\n")]), ["error:katex-only"]);
  assert.deepEqual(rules([newFile("src/components/T.tsx", "export const t = (a: string, b: string) => `${a}_${b}`;\n")]), []);
  assert.deepEqual(rules([newFile("src/components/W.tsx", 'export const W = () => <div style={{ width: "640px" }} />;\n')]), ["warn:mobile-first"]);
  assert.deepEqual(rules([newFile("src/app/w.css", ".x { width: 640px; }\n")]), ["warn:mobile-first"]);
  assert.deepEqual(rules([newFile("src/app/w.css", ".x { width: 640px; }\n@media (max-width: 640px) { .x { width: 100%; } }\n")]), []);
  assert.deepEqual(rules([newFile("src/lib/k.ts", `export const k = "ghp_${"a".repeat(30)}";\n`)]), ["error:no-secrets"]);
  const wrong = String.fromCharCode(0x0645, 0x0646, 0x0630, 0x0631, 0x20, 0x062d, 0x062f, 0x0627, 0x0631, 0x0629);
  assert.deepEqual(rules([newFile("docs/b.md", `${wrong}\n`)]), ["error:brand"]);
  assert.deepEqual(rules([newFile("docs/b.md", "منذر حداره\n")]), []);
});

test("standardsInput from proposal files; formatting; errors filter; deletes ignored", () => {
  const d = unifiedDiff("src/a.ts", null, "const a: any = 1;\n");
  const input = standardsInput([
    { path: "src/a.ts", newContent: "const a: any = 1;\n", diff: d.text, isNew: true },
    { path: "src/b.ts", newContent: "", diff: "", isNew: false, change: "delete" },
  ]);
  const findings = checkStandards(input);
  assert.equal(standardsErrors(findings).length, 1);
  assert.match(formatFindings(findings), /✖ src\/a\.ts:1 \[no-any\]/);
});

test("strings mentioning the any type are prose, ts directives count only in comments, media queries are fine", () => {
  assert.deepEqual(rules([newFile("src/lib/p.ts", 'export const help = "never use: any or as any";\n')]), []);
  assert.deepEqual(rules([newFile("src/lib/p.ts", 'export const re = "@ts-ignore";\n')]), []);
  assert.deepEqual(rules([newFile("src/lib/p.ts", "/* @ts-nocheck */\n")]), ["error:no-any"]);
  assert.deepEqual(rules([newFile("src/components/Q.tsx", 'export const q = () => window.matchMedia("(min-width: 900px)").matches;\n')]), []);
});

test("function spans ignore braces inside regex literals, strings and comments", async () => {
  const { codeOnly } = await import("../src/lib/hamza/standards.ts");
  assert.equal(codeOnly('if (!/\\btry\\s*\\{/.test(x)) { // {'), "if (! 0.test(x)) { ");
  const content = 'function a() {\n  const re = /\\{/;\n  const s = "{";\n  return re;\n}\nfunction b() {\n  return 1;\n}\n';
  assert.deepEqual(functionSpans(content).map((f) => [f.name, f.start, f.end]), [["a", 1, 5], ["b", 6, 8]]);
});
