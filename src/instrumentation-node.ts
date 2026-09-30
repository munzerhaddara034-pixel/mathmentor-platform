import { ensureDatabaseReady, isPostgresEnabled } from "./lib/db/pg";

/** Failures are logged, never fatal — requests retry the migration lazily. */
export async function migrateOnStartup(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (isPostgresEnabled()) {
    try {
      await ensureDatabaseReady();
      console.info("[mathmentor] Postgres storage ready (DATABASE_URL).");
    } catch (error) {
      console.error("[mathmentor] Postgres migration at startup failed:", error instanceof Error ? error.message : error);
    }
  }
  // One-time removal of the old seeded demo accounts (explicit email list; no-op once recorded).
  try {
    const { removeDemoAccountsOnce } = await import("./lib/auth/removeDemoAccounts");
    await removeDemoAccountsOnce();
  } catch (error) {
    console.error("[mathmentor] Demo-account cleanup at startup failed:", error instanceof Error ? error.message : error);
  }
}
