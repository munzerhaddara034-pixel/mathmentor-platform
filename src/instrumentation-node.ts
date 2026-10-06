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
  // Hamza v2 background worker (tasks + CI polling). HAMZA_WORKER=0 / HAMZA_ENABLED=0 turn it off.
  if (process.env.HAMZA_WORKER?.trim() !== "0" && process.env.HAMZA_ENABLED?.trim() !== "0") {
    try {
      const { startHamzaWorker } = await import("./lib/hamza/worker");
      const { workerDeps } = await import("./lib/hamza/runner/deps");
      const { registerRepairHandler } = await import("./lib/hamza/repair");
      registerRepairHandler();
      if (startHamzaWorker(workerDeps)) console.info("[mathmentor] Hamza worker started.");
    } catch (error) {
      console.error("[mathmentor] Hamza worker failed to start:", error instanceof Error ? error.message : error);
    }
  }
}
