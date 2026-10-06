import { test } from "node:test";
import assert from "node:assert/strict";
import { approveMerge, approveOpenPr, issueCode, refreshCi } from "../src/lib/hamza/pipeline/index.ts";
import { requestRevert } from "../src/lib/hamza/revert.ts";
import { approver, BASE_FILES, fileChange, makeDeps, makeProposal, run } from "./support/hamzaFixtures.mjs";

async function mergedProposal(fixture) {
  const files = [
    fileChange("src/components/Hello.tsx", BASE_FILES["src/components/Hello.tsx"], 'export function Hello() {\n  return <p>Hi</p>;\n}\n'),
    fileChange("src/lib/new.ts", null, "export const n = 1;\n"),
    { ...fileChange("src/lib/old.ts", BASE_FILES["src/lib/old.ts"], ""), change: "delete", newContent: "" },
  ];
  const proposal = makeProposal(files);
  await fixture.repo.saveProposal(proposal);
  const c1 = await issueCode(fixture.deps, { proposalId: proposal.id, action: "open_pr", actor: approver });
  const opened = await approveOpenPr(fixture.deps, { proposalId: proposal.id, code: c1.code, reviewed: true, actor: approver });
  fixture.github.setChecks(opened.proposal.hamza.headSha, [run(1, "hamza-ci", "completed", "success")]);
  await refreshCi(fixture.deps, { proposalId: proposal.id });
  const c2 = await issueCode(fixture.deps, { proposalId: proposal.id, action: "merge", actor: approver });
  const merged = await approveMerge(fixture.deps, { proposalId: proposal.id, code: c2.code, typedBranch: "agent-hub-latest", actor: approver });
  assert.equal(merged.proposal.status, "merged");
  return merged.proposal;
}

test("revert: merged change → new proposal restoring every touched file, then the normal PR/CI/merge path", async () => {
  const fixture = makeDeps();
  const original = await mergedProposal(fixture);
  const result = await requestRevert(fixture.deps, { proposalId: original.id, actor: approver });
  assert.equal(result.ok, true);
  const revert = result.proposal;
  assert.equal(revert.targetBranch, `fix/revert-${original.hamza.mergeSha.slice(0, 7)}`);
  assert.equal(revert.hamza.revertOf, original.id);
  const byPath = Object.fromEntries(revert.files.map((f) => [f.path, f]));
  assert.equal(byPath["src/components/Hello.tsx"].newContent, BASE_FILES["src/components/Hello.tsx"]);
  assert.equal(byPath["src/lib/new.ts"].change, "delete");
  assert.equal(byPath["src/lib/old.ts"].change, "add");
  assert.equal(byPath["src/lib/old.ts"].newContent, BASE_FILES["src/lib/old.ts"]);
  assert.ok(fixture.audits.some((a) => a.action === "hamza.revert.requested"));
  assert.equal((await requestRevert(fixture.deps, { proposalId: original.id, actor: approver })).status, 409, "only one revert");

  const c1 = await issueCode(fixture.deps, { proposalId: revert.id, action: "open_pr", actor: approver });
  const opened = await approveOpenPr(fixture.deps, { proposalId: revert.id, code: c1.code, reviewed: true, actor: approver });
  fixture.github.setChecks(opened.proposal.hamza.headSha, [run(2, "hamza-ci", "completed", "success")]);
  await refreshCi(fixture.deps, { proposalId: revert.id });
  const c2 = await issueCode(fixture.deps, { proposalId: revert.id, action: "merge", actor: approver });
  await approveMerge(fixture.deps, { proposalId: revert.id, code: c2.code, typedBranch: "agent-hub-latest", actor: approver });
  const live = fixture.github.treeOf("agent-hub-latest");
  assert.deepEqual(Object.fromEntries(live), BASE_FILES, "live branch is back to the pre-merge tree");
  const after = await fixture.repo.getProposal(original.id);
  assert.equal(after.hamza.reverted, true);
});

test("revert refuses: not merged, not allowed, or a file changed after the merge", async () => {
  const fixture = makeDeps();
  const pending = makeProposal([fileChange("docs/notes.md", BASE_FILES["docs/notes.md"], "# N\n")]);
  await fixture.repo.saveProposal(pending);
  assert.equal((await requestRevert(fixture.deps, { proposalId: pending.id, actor: approver })).status, 409);
  const original = await mergedProposal(fixture);
  assert.equal((await requestRevert(fixture.deps, { proposalId: original.id, actor: { ...approver, email: "x@example.com" } })).status, 403);
  fixture.github.pushToBase("src/components/Hello.tsx", "export const changed = true;\n");
  const blocked = await requestRevert(fixture.deps, { proposalId: original.id, actor: approver });
  assert.equal(blocked.status, 409);
  assert.match(blocked.errorAr, /Hello\.tsx/);
});

test("revert card: the chat message id equals the revert proposal's messageId (card renders)", async () => {
  const fixture = makeDeps();
  const original = await mergedProposal(fixture);
  const result = await requestRevert(fixture.deps, { proposalId: original.id, actor: approver });
  const message = fixture.repo.messages.find((m) => m.proposalId === result.proposal.id);
  assert.equal(message.id, result.proposal.messageId);
  assert.equal(message.authorKind, "agent");
});
