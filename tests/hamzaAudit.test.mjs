import { test } from "node:test";
import assert from "node:assert/strict";
import { HAMZA_AUDIT_ACTIONS, hamzaAuditRecord, isHamzaAuditAction } from "../src/lib/hamza/auditEvents.ts";
import { buildAuditEntry } from "../src/lib/security/auditEntry.ts";

test("audit vocabulary covers every pipeline step in the plan (§4.9)", () => {
  for (const action of [
    "hamza.task.created",
    "hamza.proposal.created",
    "hamza.code.issued",
    "hamza.code.failed",
    "hamza.approve.pr",
    "hamza.pr.opened",
    "hamza.ci.result",
    "hamza.approve.merge",
    "hamza.merged",
    "hamza.revert.requested",
    "hamza.revert.merged",
    "hamza.rejected",
    "hamza.budget.stop",
  ]) {
    assert.ok(isHamzaAuditAction(action), action);
  }
  assert.equal(new Set(HAMZA_AUDIT_ACTIONS).size, HAMZA_AUDIT_ACTIONS.length);
});

test("record carries actor, ip, proposal, diffHash, branch, sha, PR, model, tokens, cost; drops empties", () => {
  const r = hamzaAuditRecord("hamza.pr.opened", {
    actor: { id: "u1", email: "m@example.com", role: "admin", name: "Munzer" },
    ip: "1.2.3.4",
    details: { proposalId: "prop-1", diffHash: "abc", branch: "feat/x", sha: "deadbeef", prNumber: 12, model: "gemini:x", inputTokens: 10, outputTokens: 5, usd: 0.02, reason: "" },
  });
  assert.equal(r.target, "prop-1");
  assert.equal(r.ip, "1.2.3.4");
  assert.deepEqual(r.actor, { id: "u1", email: "m@example.com", role: "admin" });
  assert.equal(r.details.prNumber, 12);
  assert.equal(r.details.actorName, "Munzer");
  assert.equal("reason" in r.details, false);
  const entry = buildAuditEntry(r);
  assert.equal(entry.action, "hamza.pr.opened");
  assert.equal(entry.details.usd, 0.02);
});
