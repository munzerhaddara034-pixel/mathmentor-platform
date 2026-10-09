import { ensureDatabaseReady, isPostgresEnabled } from "./lib/db/pg";

/** Failures are logged, never fatal — requests retry the migration lazily. */
export async function migrateOnStartup(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Give the ops error log its storage adapter before the first request can fail (see lib/ops/errorLog).
  await import("./lib/ops/errorLogStore");
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
  await startHamzaIfConfigured();
}

/**
 * Hamza v2 background worker (tasks + CI polling). OFF by default: it starts only when Hamza is fully
 * configured (HAMZA_ENABLED=1, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, HAMZA_BASE_BRANCH, HAMZA_MODEL_PRIMARY + its
 * key; see src/lib/hamza/readiness.ts) and HAMZA_WORKER is not 0. Only variable NAMES are logged, never values.
 */
export async function startHamzaIfConfigured(): Promise<boolean> {
  const { hamzaReadiness } = await import("./lib/hamza/readiness");
  const readiness = hamzaReadiness();
  if (!readiness.ready) {
    console.info(`[mathmentor] Hamza disabled (not configured; missing: ${readiness.missing.join(", ")}).`);
    return false;
  }
  if (process.env.HAMZA_WORKER?.trim() === "0") return false;
  try {
    const { startHamzaWorker } = await import("./lib/hamza/worker");
    const { workerDeps } = await import("./lib/hamza/runner/deps");
    const { registerRepairHandler } = await import("./lib/hamza/repair");
    registerRepairHandler();
    const started = startHamzaWorker(workerDeps);
    if (started) console.info("[mathmentor] Hamza worker started.");
    return started;
  } catch (error) {
    console.error("[mathmentor] Hamza worker failed to start:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Records one unhandled server error in the first-party ops log. Lives here (Node-only) so the edge
 * bundle never pulls in the storage layer; the hook in instrumentation.ts calls it only for NEXT_RUNTIME
 * "nodejs" and never lets a failure escape.
 */
export async function recordRequestErrorNode(
  error: unknown,
  request?: { path?: string; method?: string },
  context?: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  const { recordRequestError } = await import("./lib/ops/errorLog");
  await recordRequestError(error, request, context);
}
