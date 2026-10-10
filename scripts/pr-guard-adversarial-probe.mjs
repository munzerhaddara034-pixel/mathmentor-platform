// Independent adversarial probe for the Phase 2 PR-draft guardrails.
// Run: node --import ./tests/support/register.mjs scripts/pr-guard-adversarial-probe.mjs
// Only REJECTION cases plus one accepted control are exercised, so nothing is stored except the control.

const mod = await import("../src/lib/team/prDrafts.ts");

const hunk = (path, body = "+export const x = 1;") =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -0,0 +1,1 @@\n${body}\n`;

const base = {
  agentId: "developer",
  title: "probe",
  summary: "probe",
  rationale: "probe",
  files: ["src/a.ts"],
  patch: hunk("src/a.ts"),
};

const cases = [
  ["path traversal into .env", { patch: hunk("src/../.env") }],
  ["absolute path", { patch: hunk("/etc/passwd") }],
  ["backslash path", { patch: hunk("src\\lib\\auth\\x.ts") }],
  ["doubled slash into auth", { patch: hunk("src//lib/auth/x.ts") }],
  ["url-encoded auth segment", { patch: hunk("src/lib/%61uth/x.ts") }],
  ["case-variant denylist (.ENV)", { patch: hunk(".ENV") }],
  ["case-variant denylist (Auth dir)", { patch: hunk("src/lib/Auth/x.ts") }],
  ["dot-slash prefix denylist", { patch: hunk("./src/lib/security/x.ts") }],
  ["security via .. hop", { patch: hunk("src/lib/security/../auth/x.ts") }],
  ["env file variant", { patch: hunk(".env.production") }],
  ["lockfile", { patch: hunk("package-lock.json") }],
  ["CI workflow via docs hop", { patch: hunk("docs/../.github/workflows/x.yml") }],
  ["symlink mode to .env", { patch: `diff --git a/src/a.ts b/src/a.ts\nnew file mode 120000\n--- /dev/null\n+++ b/src/a.ts\n@@ -0,0 +1,1 @@\n+.env\n` }],
  ["binary patch", { patch: `diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\nGIT binary patch\nliteral 12\nzcmZQ\n` }],
  ["hidden second file in same patch", { patch: hunk("src/a.ts") + hunk("src/lib/auth/x.ts") }],
  ["declared files mismatch (1 declared, 2 in patch)", { files: ["src/a.ts"], patch: hunk("src/a.ts") + hunk("src/b.ts") }],
  ["declared files hides denied path", { files: ["src/a.ts"], patch: hunk("src/a.ts") + hunk(".env") }],
  ["13 files", { patch: Array.from({ length: 13 }, (_, i) => hunk(`src/f${i}.ts`)).join("") }],
  ["401 changed lines", { patch: hunk("src/a.ts", Array.from({ length: 401 }, () => "+x").join("\n")) }],
  ["oversize patch bytes", { patch: hunk("src/a.ts", `+${"a".repeat(210 * 1024)}`) }],
  ["commit message too long", { title: "x".repeat(260) }],
  ["agentId injection (semicolon)", { agentId: "developer; rm -rf /" }],
  ["agentId traversal", { agentId: "../evil" }],
  ["agentId with slash", { agentId: "developer/../main" }],
  ["agentId empty", { agentId: "" }],
  ["agentId unicode", { agentId: "مطوّر" }],
];

const envBefore = process.env.AGENT_PR_DRAFTS;
const results = [];
for (const [name, patchInput] of cases) {
  let verdict;
  try {
    const r = await mod.draftPullRequest({ ...base, ...patchInput });
    verdict = r && r.ok ? "ACCEPTED ⚠️" : `rejected (${r?.reason ?? r?.error ?? "no-reason"})`;
  } catch (error) {
    verdict = `threw (${String(error?.message ?? error).slice(0, 40)})`;
  }
  results.push([name, verdict]);
}

// control: a clean patch must be accepted
let control;
try {
  const r = await mod.draftPullRequest({ ...base, patch: hunk("src/control.ts"), files: ["src/control.ts"] });
  control = r && r.ok ? "ACCEPTED ✅" : `rejected (${r?.reason ?? "no-reason"}) ⚠️`;
} catch (error) {
  control = `threw (${String(error?.message ?? error).slice(0, 40)}) ⚠️`;
}

// kill switch must disable without touching the network
process.env.AGENT_PR_DRAFTS = "off";
let kill;
try {
  const r = await mod.draftPullRequest({ ...base, patch: hunk("src/control2.ts"), files: ["src/control2.ts"] });
  kill = r && r.ok ? "ACCEPTED ⚠️" : `blocked (${r?.reason ?? r?.error ?? "no-reason"}) ✅`;
} catch (error) {
  kill = `threw (${String(error?.message ?? error).slice(0, 40)})`;
}
if (envBefore === undefined) delete process.env.AGENT_PR_DRAFTS;
else process.env.AGENT_PR_DRAFTS = envBefore;

const bad = results.filter(([, v]) => v.startsWith("ACCEPTED"));
console.log("=== INDEPENDENT ADVERSARIAL PROBE ===");
for (const [name, verdict] of results) console.log(`  ${verdict.startsWith("ACCEPTED") ? "⚠️ " : "✅ "}${name.padEnd(46)} → ${verdict}`);
console.log(`  ${control.startsWith("ACCEPTED") ? "✅" : "⚠️"} clean control patch${" ".repeat(28)} → ${control}`);
console.log(`  ✅ kill switch AGENT_PR_DRAFTS=off${" ".repeat(18)} → ${kill}`);
console.log(`\nSUMMARY: ${results.length} attack vectors, ${bad.length} accepted (should be 0), control ${control.startsWith("ACCEPTED") ? "passes" : "FAILS"}`);