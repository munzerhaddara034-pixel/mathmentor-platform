/**
 * Public liveness/readiness report for /api/health. Deliberately minimal: ok flag, short build id,
 * and the database state as "up" | "down" | "disabled" — never URLs, hostnames, error text or env.
 */
export type HealthReport = { ok: boolean; service: "mathmentor"; version: string | null; db: "up" | "down" | "disabled"; time: string };

export function buildVersion(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.RENDER_GIT_COMMIT || env.GIT_COMMIT || env.COMMIT_REF || env.VERCEL_GIT_COMMIT_SHA || "").trim();
  return /^[0-9a-f]{7,40}$/i.test(raw) ? raw.slice(0, 7).toLowerCase() : null;
}

export async function healthReport(opts: {
  dbEnabled: boolean;
  probe: () => Promise<unknown>;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
  now?: Date;
}): Promise<HealthReport> {
  let db: HealthReport["db"] = "disabled";
  if (opts.dbEnabled) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        opts.probe(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), opts.timeoutMs ?? 3000);
        }),
      ]);
      db = "up";
    } catch {
      db = "down";
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    ok: db !== "down",
    service: "mathmentor",
    version: buildVersion(opts.env),
    db,
    time: (opts.now ?? new Date()).toISOString(),
  };
}
