/** Postgres (mm_ai_queries) backend for the AI solver query log + teacher audit. */
import { dbQuery, withTransaction } from "@/lib/db/pg";
import type { MathQueryRecord } from "./types";

type QueryRow = { data: MathQueryRecord };

export async function pgInsertQuery(record: MathQueryRecord): Promise<void> {
  await dbQuery(
    `INSERT INTO mm_ai_queries (id, user_id, audit_status, created_at, updated_at, data)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, audit_status = EXCLUDED.audit_status,
       updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
    [
      record.id,
      record.userId ?? null,
      record.auditStatus ?? null,
      record.createdAt,
      record.updatedAt,
      JSON.stringify(record),
    ],
  );
}

export async function pgGetQuery(id: string): Promise<MathQueryRecord | undefined> {
  const rows = await dbQuery<QueryRow>("SELECT data FROM mm_ai_queries WHERE id = $1", [id]);
  return rows[0]?.data;
}

export async function pgListQueries(filter: { userId?: string; limit: number }): Promise<MathQueryRecord[]> {
  const rows = filter.userId
    ? await dbQuery<QueryRow>(
        "SELECT data FROM mm_ai_queries WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        [filter.userId, filter.limit],
      )
    : await dbQuery<QueryRow>("SELECT data FROM mm_ai_queries ORDER BY created_at DESC LIMIT $1", [filter.limit]);
  return rows.map((row) => row.data);
}

export async function pgPatchQuery(
  id: string,
  patch: (current: MathQueryRecord) => MathQueryRecord,
): Promise<MathQueryRecord | undefined> {
  return withTransaction(async (client) => {
    const found = await client.query<QueryRow>("SELECT data FROM mm_ai_queries WHERE id = $1 FOR UPDATE", [id]);
    const current = found.rows[0]?.data;
    if (!current) return undefined;
    const next = patch(current);
    await client.query(
      `UPDATE mm_ai_queries SET user_id = $2, audit_status = $3, updated_at = $4, data = $5::jsonb WHERE id = $1`,
      [id, next.userId ?? null, next.auditStatus ?? null, next.updatedAt, JSON.stringify(next)],
    );
    return next;
  });
}
