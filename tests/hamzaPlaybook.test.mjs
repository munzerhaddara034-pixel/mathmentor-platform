import { test } from "node:test";
import assert from "node:assert/strict";
import { agentProtocol } from "../src/lib/hamza/agent/protocol.ts";
import {
  HAMZA_ANTI_PATTERNS,
  HAMZA_LESSONS,
  HAMZA_TEST_RECIPES,
  HAMZA_WORKFLOW,
  hamzaEngineerBrief,
  mentionsTestEvidence,
} from "../src/lib/hamza/playbook.ts";
import { memorySnapshot } from "../src/lib/hamza/snapshot.ts";
import { createRepoTools } from "../src/lib/hamza/tools.ts";

const brief = hamzaEngineerBrief();
const protocol = agentProtocol({
  repo: "munzerhaddara034-pixel/mathmentor-platform",
  base: "agent-hub-latest",
  sha: "a".repeat(40),
  maxToolCalls: 40,
});

test("workflow demands restating, exploring, self-review and evidence", () => {
  assert.match(HAMZA_WORKFLOW, /Restate the request/);
  assert.match(HAMZA_WORKFLOW, /read EVERY file/);
  assert.match(HAMZA_WORKFLOW, /Self-review before proposing/);
  assert.match(HAMZA_WORKFLOW, /get_ci_log/);
  assert.match(HAMZA_TEST_RECIPES, /node:test/);
  assert.match(HAMZA_TEST_RECIPES, /failure path/);
});

test("lessons carry this platform's real failures, not generic advice", () => {
  assert.match(HAMZA_LESSONS, /neighbouring label/);
  assert.match(HAMZA_LESSONS, /SSRF|private\/loopback/);
  assert.match(HAMZA_LESSONS, /atomic/);
  assert.match(HAMZA_LESSONS, /Fail closed/);
  assert.match(HAMZA_LESSONS, /regression test/);
  assert.match(HAMZA_LESSONS, /Cold starts/);
});

test("anti-patterns block the shortcuts that hide bugs", () => {
  assert.match(HAMZA_ANTI_PATTERNS, /skipped to make CI green/);
  assert.match(HAMZA_ANTI_PATTERNS, /ts-ignore/);
  assert.match(HAMZA_ANTI_PATTERNS, /hardcode a secret/);
  assert.match(HAMZA_ANTI_PATTERNS, /package-lock\.json/);
  assert.match(HAMZA_ANTI_PATTERNS, /placeholder data/);
});

test("the brief fits the prompt budget and degrades in priority order", () => {
  assert.ok(brief.length > 2_000, `brief is only ${brief.length} chars`);
  assert.ok(brief.length <= 9_000, `brief is ${brief.length} chars — over budget`);
  const tiny = hamzaEngineerBrief(1_200);
  assert.ok(tiny.length <= 1_280, `trimmed brief is ${tiny.length} chars`);
  assert.match(tiny, /Senior workflow/);
  assert.match(tiny, /trimmed to fit the prompt budget/);
});

test("the agent protocol ships the playbook next to the tools", () => {
  assert.match(protocol, /Senior workflow/);
  assert.match(protocol, /Never do this/);
  assert.match(protocol, /tests_for/);
  assert.ok(protocol.length < 20_000, `protocol is ${protocol.length} chars`);
});

test("tests_for names the covering test, or says one must be added", async () => {
  const tools = createRepoTools({
    snapshot: memorySnapshot({
      "src/lib/solver/llm.ts": "export const solve = (): number => 1;\n",
      "tests/solverSchemaResilience.test.mjs": 'import "../src/lib/solver/llm.ts";\n',
      "tests/wallet.test.mjs": "export const y = 1;\n",
    }),
    ciChecks: ["hamza-ci"],
  });
  assert.match(await tools.run("tests_for", { path: "src/lib/solver/llm.ts" }), /solverSchemaResilience\.test\.mjs/);
  assert.match(await tools.run("tests_for", { path: "src/lib/nope/missing.ts" }), /No test references missing/);
  assert.match(await tools.run("tests_for", {}), /Test files \(2\)/);
});

test("mentionsTestEvidence flags a fix that ships without a test", () => {
  assert.equal(mentionsTestEvidence("fix(solver): tolerant labels", ["src/lib/solver/llm.ts"]), false);
  assert.equal(mentionsTestEvidence("fix(solver): tolerant labels", ["src/lib/solver/llm.ts", "tests/solver.test.mjs"]), true);
  assert.equal(mentionsTestEvidence("feat(ui): new card", ["src/components/x.tsx"]), true);
});