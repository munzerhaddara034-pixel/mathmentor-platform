// Approval codes: single-use, expiring, bound to the exact diff / revision / action / branch, attempt-limited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_PREFIX, issueApprovalCode, normalizeCode, verifyApprovalCode } from "../src/lib/hamza/codes.ts";
import { computeDiffHash } from "../src/lib/hamza/diffHash.ts";

const binding = { proposalId: "prop-1", revision: 1, diffHash: "a".repeat(64), action: "open_pr", targetBranch: "feat/x" };
const now = new Date("2026-10-04T20:00:00Z");
const opts = { now, ttlMinutes: 30, issuedTo: "munzer@example.com" };

test("issued code looks like HMZ-XXXXXX and is stored hashed only", () => {
  const { code, stored } = issueApprovalCode(binding, opts);
  assert.match(code, /^HMZ-[A-HJ-NP-Z2-9]{6}$/);
  assert.ok(code.startsWith(CODE_PREFIX));
  assert.ok(!JSON.stringify(stored).includes(code.slice(4)));
  assert.equal(stored.expiresAt, "2026-10-04T20:30:00.000Z");
});

test("correct code verifies once (single use); tolerant to case / prefix / spaces", () => {
  const { code, stored } = issueApprovalCode(binding, opts);
  assert.equal(normalizeCode(` hmz-${code.slice(4, 7).toLowerCase()} ${code.slice(7)} `), code.slice(4));
  const ok = verifyApprovalCode(stored, { code: code.slice(4).toLowerCase(), binding, now, maxAttempts: 5 });
  assert.equal(ok.ok, true);
  const again = verifyApprovalCode(ok.stored, { code, binding, now, maxAttempts: 5 });
  assert.deepEqual([again.ok, again.reason], [false, "used"]);
});

test("expired, stale (new revision / other diff / other action / other branch), missing", () => {
  const { code, stored } = issueApprovalCode(binding, opts);
  const late = new Date(now.getTime() + 31 * 60_000);
  assert.equal(verifyApprovalCode(stored, { code, binding, now: late, maxAttempts: 5 }).reason, "expired");
  for (const change of [{ revision: 2 }, { diffHash: "b".repeat(64) }, { action: "merge" }, { targetBranch: "feat/y" }]) {
    const r = verifyApprovalCode(stored, { code, binding: { ...binding, ...change }, now, maxAttempts: 5 });
    assert.equal(r.reason, "stale", JSON.stringify(change));
  }
  assert.equal(verifyApprovalCode(undefined, { code, binding, now, maxAttempts: 5 }).reason, "missing");
});

test("wrong codes count attempts and lock after the limit", () => {
  const { code, stored } = issueApprovalCode(binding, opts);
  let current = stored;
  for (let i = 0; i < 5; i += 1) {
    const r = verifyApprovalCode(current, { code: "HMZ-AAAAAA", binding, now, maxAttempts: 5 });
    assert.equal(r.reason, "mismatch");
    current = r.stored;
  }
  assert.equal(current.attempts, 5);
  assert.equal(verifyApprovalCode(current, { code, binding, now, maxAttempts: 5 }).reason, "locked");
});

test("diff hash: order-independent, changes with content / base / delete / rename", () => {
  const a = { path: "src/a.ts", baseSha: "1", newContent: "x\n" };
  const b = { path: "src/b.ts", baseSha: null, newContent: "y\n" };
  assert.equal(computeDiffHash([a, b]), computeDiffHash([b, a]));
  assert.notEqual(computeDiffHash([a]), computeDiffHash([{ ...a, newContent: "z\n" }]));
  assert.notEqual(computeDiffHash([a]), computeDiffHash([{ ...a, baseSha: "2" }]));
  assert.notEqual(computeDiffHash([a]), computeDiffHash([{ ...a, change: "delete" }]));
  assert.notEqual(computeDiffHash([a]), computeDiffHash([{ ...a, change: "rename", oldPath: "src/old.ts" }]));
  assert.match(computeDiffHash([a]), /^[0-9a-f]{64}$/);
});
