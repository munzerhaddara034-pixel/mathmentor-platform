#!/usr/bin/env node
// Standards gate for `hamza-ci` (and humans): judges the lines this branch ADDS versus HAMZA_STANDARDS_BASE.
// Run: node --import ./tests/support/register.mjs scripts/check-standards.mjs [--json]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { checkStandards, formatFindings, standardsErrors } from "../src/lib/hamza/standards.ts";

const base = process.env.HAMZA_STANDARDS_BASE || "origin/agent-hub-latest";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

let mergeBase;
try {
  mergeBase = git("merge-base", base, "HEAD").trim();
} catch {
  console.log(`check-standards: base "${base}" not found — skipped.`);
  process.exit(0);
}

const files = [];
for (const row of git("diff", "--name-status", "-M", mergeBase, "HEAD").split("\n").filter(Boolean)) {
  const [status, first, second] = row.split("\t");
  const path = status.startsWith("R") ? second : first;
  if (status.startsWith("D") || !/\.(ts|tsx|mts|cts|css|md|json)$/.test(path)) continue;
  const content = readFileSync(path, "utf8");
  const addedLines = [];
  let line = 0;
  for (const diffRow of git("diff", "-U0", "-M", mergeBase, "HEAD", "--", path).split("\n")) {
    const hunk = diffRow.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) line = Number(hunk[1]);
    else if (line && diffRow.startsWith("+") && !diffRow.startsWith("+++")) addedLines.push(line++);
  }
  files.push({ path, content, addedLines, isNew: status.startsWith("A") });
}

const findings = checkStandards(files);
const errors = standardsErrors(findings);
if (process.argv.includes("--json")) console.log(JSON.stringify({ base, mergeBase, files: files.length, findings }, null, 2));
else {
  console.log(`check-standards: ${files.length} changed file(s) vs ${base} (${mergeBase.slice(0, 7)})`);
  if (findings.length) console.log(formatFindings(findings));
  console.log(errors.length ? `✖ ${errors.length} error(s), ${findings.length - errors.length} warning(s)` : `✓ no errors (${findings.length} warning(s))`);
}
process.exit(errors.length ? 1 : 0);
