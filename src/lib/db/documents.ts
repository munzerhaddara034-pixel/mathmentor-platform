/**
 * JSON document table (`mm_documents`) — one row per former data/*.json store.
 * Keeps the read-modify-write semantics of the file stores so no store logic changes.
 */
import { dbQuery, withTransaction } from "./pg";

type DocumentRow = { data: unknown };

export async function pgGetDocument(key: string): Promise<unknown | null> {
  const rows = await dbQuery<DocumentRow>("SELECT data FROM mm_documents WHERE key = $1", [key]);
  return rows.length ? rows[0].data : null;
}

export async function pgSetDocument(key: string, value: unknown): Promise<void> {
  await dbQuery(
    `INSERT INTO mm_documents (key, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [key, JSON.stringify(value ?? null)],
  );
}

export async function pgListDocumentKeys(): Promise<Array<{ key: string; updatedAt: string }>> {
  const rows = await dbQuery<{ key: string; updated_at: Date }>(
    "SELECT key, updated_at FROM mm_documents ORDER BY key",
  );
  return rows.map((row) => ({ key: row.key, updatedAt: row.updated_at.toISOString() }));
}

/**
 * Atomic read-modify-write of one document across processes: the row is created if missing,
 * then locked with SELECT … FOR UPDATE inside a transaction until the new value is written.
 */
export async function pgUpdateDocument<T>(key: string, fallback: T, update: (current: T) => T | Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO mm_documents (key, data, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(fallback ?? null)],
    );
    const result = await client.query<DocumentRow>("SELECT data FROM mm_documents WHERE key = $1 FOR UPDATE", [key]);
    const current = (result.rows[0]?.data ?? fallback) as T;
    const next = await update(current);
    await client.query("UPDATE mm_documents SET data = $2::jsonb, updated_at = now() WHERE key = $1", [
      key,
      JSON.stringify(next ?? null),
    ]);
    return next;
  });
}
