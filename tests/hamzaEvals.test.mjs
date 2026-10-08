import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseEvalFile, scoreEval } from "../src/lib/hamza/evals.ts";
import { buildRepoMap } from "../src/lib/hamza/repoMap.ts";
import { unifiedDiff } from "../src/lib/team/diff.ts";

const evals = parseEvalFile(JSON.parse(readFileSync(new URL("../docs/hamza/evals.json", import.meta.url), "utf8")));
const file = (path, content, extra = {}) => {
  const d = unifiedDiff(path, null, content);
  return { path, baseSha: null, isNew: true, newContent: content, diff: d.text, additions: d.additions, deletions: d.deletions, change: "add", ...extra };
};

test("eval set: 15 well-formed cases with unique ids", () => {
  assert.equal(evals.length, 15);
  assert.equal(new Set(evals.map((e) => e.id)).size, 15);
  const brand = String.fromCharCode(0x062d, 0x062f, 0x0627, 0x0631, 0x0629);
  assert.ok(!readFileSync(new URL("../docs/hamza/evals.json", import.meta.url), "utf8").includes(brand));
});

test("scorer: perfect, partial and refusal cases", () => {
  const e10 = evals.find((e) => e.id === "E10-new-module-test");
  const good = scoreEval(e10, { kind: "proposal", branch: "feat/minutes", files: [file("src/lib/format/minutes.ts", "export const m = (n: number): string => `${n}`;\n"), file("tests/minutes.test.mjs", "import test from 'node:test';\n")] });
  assert.equal(good.passed, true);
  assert.equal(good.score, 1);
  const noTest = scoreEval(e10, { kind: "proposal", files: [file("src/lib/format/minutes.ts", "export const m = (n: any) => n;\n")] });
  assert.equal(noTest.passed, false);
  assert.ok(noTest.checks.find((c) => c.name === "standards: no errors").ok === false);
  const e09 = evals.find((e) => e.id === "E09-workflow-refusal");
  assert.equal(scoreEval(e09, { kind: "reply", replyText: "لا أستطيع تعديل .github" }).passed, true);
  const e07 = evals.find((e) => e.id === "E07-secret-refusal");
  const token = ["E", "A", "A"].join("") + "Gm0PX4ZCpsBAxyz123abcDEF";
  assert.ok(e07.request.includes(token), "placeholder expanded");
  assert.equal(scoreEval(e07, { kind: "reply", replyText: `${token.slice(0, 8)}… لن أكتبه` }).passed, false);
  assert.equal(scoreEval(e07, { kind: "proposal", branch: "fix/wa", files: [file("src/app/api/wa/route.ts", `const t = "${token}";\n`)] }).passed, false);
  assert.equal(scoreEval(e07, { kind: "proposal", branch: "fix/wa", files: [file("src/app/api/wa/route.ts", "export const t = (): string => process.env.WHATSAPP_ACCESS_TOKEN ?? \"\";\n")] }).passed, true);
  const e03 = evals.find((e) => e.id === "E03-rename-component");
  const renamed = scoreEval(e03, { kind: "proposal", branch: "feat/x", files: [file("src/components/auth/LogoutButton.tsx", "export {};\n", { change: "rename", oldPath: "src/components/LogoutButton.tsx" }), file("src/components/Nav.tsx", "export {};\n")] });
  assert.equal(renamed.passed, true);
  const e12 = evals.find((e) => e.id === "E12-ambiguous");
  assert.equal(scoreEval(e12, { kind: "reply", replyText: "أي صفحة؟ وما المشكلة؟" }).passed, false);
});

test("repo map: routes, API routes, areas", () => {
  const map = buildRepoMap(["src/app/page.tsx", "src/app/wallet/page.tsx", "src/app/(auth)/login/page.tsx", "src/app/api/health/route.ts", "src/components/ui/Skeleton.tsx", "src/lib/hamza/x.ts", "tests/a.test.mjs"]);
  assert.match(map, /Pages \(3\): \/ \/login \/wallet/);
  assert.match(map, /API routes \(1\): \/api\/health/);
  assert.match(map, /Components: ui \(1\)/);
  assert.match(map, /Tests: 1 files/);
});
