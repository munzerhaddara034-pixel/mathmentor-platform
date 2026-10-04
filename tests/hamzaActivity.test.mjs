import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeActivity } from "../src/lib/hamza/activity.ts";

const cost = (usd, models) => ({ usd, inputTokens: 0, cachedTokens: 0, outputTokens: 0, calls: 1, models });
const task = (id, createdAt, usd, models = ["gemini:pro"]) => ({ id, createdAt, cost: cost(usd, models), status: "done" });

test("activity: month total, counts from audit events, cost by model, newest first", () => {
  const start = "2026-09-30T21:00:00.000Z";
  const activity = summarizeActivity({
    monthKey: "2026-10",
    monthStartIso: start,
    tasks: [task("old", "2026-09-20T10:00:00Z", 9), task("a", "2026-10-02T10:00:00Z", 1.5), task("b", "2026-10-03T10:00:00Z", 0.5, ["gemini:pro", "openai:codex"])],
    events: [
      { at: "2026-10-03T11:00:00Z", action: "hamza.ci.result", target: "p1", actorEmail: null, details: { result: "failed" } },
      { at: "2026-10-03T10:30:00Z", action: "hamza.pr.opened", target: "p1", actorEmail: "m@x", details: {} },
      { at: "2026-10-03T10:20:00Z", action: "hamza.proposal.created", target: "p1", actorEmail: null, details: {} },
      { at: "2026-09-21T10:20:00Z", action: "hamza.merged", target: "p0", actorEmail: null, details: {} },
    ],
    caps: { monthCapUsd: 60, taskCapUsd: 2, taskMaxUsd: 5 },
  });
  assert.equal(activity.monthUsd, 2);
  assert.deepEqual(activity.counts, { tasks: 2, proposals: 1, prs: 1, merged: 0, ciFailed: 1, reverts: 0 });
  assert.deepEqual(activity.byModel, [{ model: "gemini:pro", usd: 1.75 }, { model: "openai:codex", usd: 0.25 }]);
  assert.deepEqual(activity.tasks.map((t) => t.id), ["b", "a", "old"]);
  assert.equal(activity.events.length, 4);
});
