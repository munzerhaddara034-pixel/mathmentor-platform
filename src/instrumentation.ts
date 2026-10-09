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

/**
 * Next.js error hook: every unhandled server error (route handler, RSC, server action) is written to the
 * first-party ops log before it reaches the client, so the platform fails loudly instead of silently.
 * It imports only the runtime-agnostic core (`lib/ops/errorLog`), never throws, and never blocks the
 * response — logging must not break the request it describes.
 */
export async function onRequestError(
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordRequestError } = await import("./lib/ops/errorLog");
    await recordRequestError(error, request, context);
  } catch {
    // A failed log write is never allowed to escalate.
  }
}