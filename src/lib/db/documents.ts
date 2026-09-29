/**
 * JSON document table (`mm_documents`) — one row per former data/*.json store.
 * Keeps the read-modify-write semantics of the file stores so no store logic changes.
 */
import { dbQuery } from "./pg";

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
