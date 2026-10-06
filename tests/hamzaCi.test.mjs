import { test } from "node:test";
import assert from "node:assert/strict";
import { extractErrorLines, failingJobIds, formatCiReport, summarizeChecks } from "../src/lib/hamza/ci.ts";

const now = new Date("2026-10-04T20:10:00Z");
const run = (id, name, status, conclusion) => ({ id, name, status, conclusion, startedAt: "2026-10-04T20:00:00Z", completedAt: status === "completed" ? "2026-10-04T20:04:00Z" : undefined, jobId: id });

test("required check decides: running → passed / failed; latest re-run wins", () => {
  const base = { required: ["hamza-ci"], headSha: "abc1234def", now };
  assert.equal(summarizeChecks({ ...base, runs: [run(1, "hamza-ci", "in_progress", null)] }).state, "running");
  assert.equal(summarizeChecks({ ...base, runs: [run(1, "hamza-ci", "completed", "success")] }).state, "passed");
  assert.equal(summarizeChecks({ ...base, runs: [run(1, "hamza-ci", "completed", "failure")] }).state, "failed");
  assert.equal(summarizeChecks({ ...base, runs: [run(1, "hamza-ci", "completed", "failure"), run(2, "hamza-ci", "completed", "success")] }).state, "passed");
  // Other (non-required) checks do not block, but are reported.
  const s = summarizeChecks({ ...base, runs: [run(1, "hamza-ci", "completed", "success"), run(3, "netlify", "completed", "failure")] });
  assert.equal(s.state, "passed");
  assert.equal(s.checks.length, 2);
  assert.equal(s.checks[0].durationSec, 240);
});

test("no CI run: pending, then missing after the grace period", () => {
  const base = { required: ["hamza-ci"], headSha: "abc", runs: [] };
  assert.equal(summarizeChecks({ ...base, now, waitingSinceMs: now.getTime() - 60_000 }).state, "pending");
  assert.equal(summarizeChecks({ ...base, now, waitingSinceMs: now.getTime() - 11 * 60_000 }).state, "missing");
});

test("failing job ids and the first error lines of the log", () => {
  assert.deepEqual(failingJobIds([run(7, "hamza-ci", "completed", "failure"), run(8, "x", "completed", "failure")], ["hamza-ci"]), [7]);
  const log = [
    "2026-10-04T20:01:00.1234567Z ##[group]Run npx tsc --noEmit",
    "2026-10-04T20:01:01.0000000Z \u001b[31msrc/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\u001b[0m",
    "2026-10-04T20:01:01.0000000Z src/b.ts(9,1): error TS2304: Cannot find name 'foo'.",
    ...Array.from({ length: 50 }, (_, i) => `2026-10-04T20:01:02.0000000Z line ${i}`),
  ].join("\n");
  const excerpt = extractErrorLines(log, 30);
  assert.ok(excerpt.includes("error TS2322"));
  assert.ok(!excerpt.includes("\u001b"));
  assert.ok(!excerpt.includes("2026-10-04T20:01"));
  assert.ok(excerpt.split("\n").length <= 30);
});

test("chat report lists each check and the merge rule when green", () => {
  const summary = summarizeChecks({ runs: [run(1, "hamza-ci", "completed", "success")], required: ["hamza-ci"], headSha: "abc1234def", now });
  const text = formatCiReport({ summary, prNumber: 12, prUrl: "https://github.com/o/r/pull/12" });
  assert.match(text, /✅ نجح فحص CI/);
  assert.match(text, /PR #12 · abc1234/);
  assert.match(text, /- ✅ hamza-ci \(240 ث\)/);
  assert.match(text, /الموافقة الثانية/);
});
