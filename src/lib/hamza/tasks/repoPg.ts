/** Postgres task store (mm_hamza_tasks / mm_hamza_steps, migration 007). Claims use FOR UPDATE SKIP LOCKED. */
import { dbQuery, withTransaction } from "@/lib/db/pg";
import type { AgentStepRecord } from "../agent/types";
import { claimIn, updateIn, type TaskStore } from "./engine";
import type { HamzaTask, HamzaTaskRepo } from "./types";

type Row = { data: HamzaTask };

async function write(client: { query: (sql: string, params: unknown[]) => Promise<unknown> }, task: HamzaTask): Promise<void> {
  await client.query(
    `UPDATE mm_hamza_tasks SET status = $2, updated_at = $3, locked_until = $4, cost_usd = $5, data = $6::jsonb WHERE id = $1`,
    [task.id, task.status, task.updatedAt, task.lockedUntil ?? null, task.cost.usd, JSON.stringify(task)],
  );
}

export const pgTaskRepo: HamzaTaskRepo = {
  kind: "postgres",
  async create(task) {
    await dbQuery(
      `INSERT INTO mm_hamza_tasks (id, channel, status, created_at, updated_at, locked_until, cost_usd, data) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [task.id, task.channel, task.status, task.createdAt, task.updatedAt, task.lockedUntil ?? null, task.cost.usd, JSON.stringify(task)],
    );
  },
  async get(id) {
    return (await dbQuery<Row>("SELECT data FROM mm_hamza_tasks WHERE id = $1", [id]))[0]?.data;
  },
  async update(id, from, patch) {
    return withTransaction(async (client) => {
      const found = await client.query<Row>("SELECT data FROM mm_hamza_tasks WHERE id = $1 FOR UPDATE", [id]);
      const current = found.rows[0]?.data;
      if (!current) return undefined;
      const store: TaskStore = { tasks: [current], steps: {} };
      const next = updateIn(store, id, from, patch);
      if (next) await write(client, next);
      return next;
    });
  },
  async claimNext(workerId, now, leaseMs) {
    return withTransaction(async (client) => {
      const found = await client.query<Row>(
        `SELECT data FROM mm_hamza_tasks
          WHERE status = 'queued' OR (status = 'running' AND locked_until < $1)
          ORDER BY created_at ASC LIMIT 5 FOR UPDATE SKIP LOCKED`,
        [now.toISOString()],
      );
      const store: TaskStore = { tasks: found.rows.map((row) => row.data), steps: {} };
      const claimed = claimIn(store, workerId, now, leaseMs);
      for (const task of store.tasks) await write(client, task);
      return claimed;
    });
  },
  async listByChannel(channel, limit) {
    const rows = await dbQuery<Row>(
      `SELECT data FROM (SELECT data, created_at FROM mm_hamza_tasks WHERE channel = $1 ORDER BY created_at DESC LIMIT $2) recent ORDER BY created_at ASC`,
      [channel, limit],
    );
    return rows.map((row) => row.data);
  },
  async listActive() {
    const rows = await dbQuery<Row>(`SELECT data FROM mm_hamza_tasks WHERE status IN ('queued', 'running', 'budget_paused') ORDER BY created_at ASC`);
    return rows.map((row) => row.data);
  },
  async addStep(taskId, step) {
    await dbQuery(`INSERT INTO mm_hamza_steps (task_id, at, data) VALUES ($1, $2, $3::jsonb)`, [taskId, step.at, JSON.stringify(step)]);
  },
  async listSteps(taskId, limit) {
    const rows = await dbQuery<{ data: AgentStepRecord }>(
      `SELECT data FROM (SELECT data, id FROM mm_hamza_steps WHERE task_id = $1 ORDER BY id DESC LIMIT $2) recent ORDER BY id ASC`,
      [taskId, limit],
    );
    return rows.map((row) => row.data);
  },
  async monthSpentUsd(sinceIso) {
    const rows = await dbQuery<{ total: string | null }>(`SELECT COALESCE(SUM(cost_usd), 0)::text AS total FROM mm_hamza_tasks WHERE created_at >= $1`, [sinceIso]);
    return Number(rows[0]?.total ?? 0);
  },
};
