import { ensureDatabaseReady, isPostgresEnabled } from "./lib/db/pg";

/** Failures are logged, never fatal — requests retry the migration lazily. */
export async function migrateOnStartup(): Promise<void> {
  if (!isPostgresEnabled()) return;
  try {
    await ensureDatabaseReady();
    console.info("[mathmentor] Postgres storage ready (DATABASE_URL).");
  } catch (error) {
    console.error("[mathmentor] Postgres migration at startup failed:", error instanceof Error ? error.message : error);
  }
}
