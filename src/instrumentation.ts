/**
 * Next.js startup hook: run the idempotent Postgres migration once when DATABASE_URL is set.
 * The Node-only code lives in instrumentation-node.ts so the edge bundle never pulls in `pg`.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateOnStartup } = await import("./instrumentation-node");
    await migrateOnStartup();
  }
}
