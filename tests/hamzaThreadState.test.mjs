import { test } from "node:test";
import assert from "node:assert/strict";
import { hasActiveWork, taskCardOwners, threadFrom } from "../src/components/admin/team/threadState.ts";

test("thread state: tasks indexed, polling only while queued/running, TaskCard under the first task message", () => {
  const thread = threadFrom({
    ok: true,
    channel: "developer",
    storage: "file",
    messages: [
      { id: "m1", taskId: "t1" },
      { id: "m2" },
      { id: "m3", taskId: "t1" },
      { id: "m4", taskId: "t2" },
    ],
    proposals: [{ id: "p1" }],
    tasks: [{ id: "t1", status: "done" }, { id: "t2", status: "budget_paused" }],
  });
  assert.deepEqual(Object.keys(thread.tasks), ["t1", "t2"]);
  assert.equal(hasActiveWork(thread), false, "paused tasks wait for a human; no polling");
  assert.equal(hasActiveWork({ ...thread, tasks: { t3: { id: "t3", status: "running" } } }), true);
  const owners = taskCardOwners(thread.messages);
  assert.equal(owners.get("t1"), "m1");
  assert.equal(owners.get("t2"), "m4");
  assert.deepEqual(threadFrom({ messages: [], proposals: [] }).tasks, {}, "old servers without tasks");
});
