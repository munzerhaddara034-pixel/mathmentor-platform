import { NextResponse } from "next/server";
import { getPool, isPostgresEnabled } from "@/lib/db/pg";
import { healthReport, retryingProbe } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public health probe: 200 when healthy, 503 when the database is configured but unreachable. */
export async function GET() {
  const report = await healthReport({
    dbEnabled: isPostgresEnabled(),
    // A sleeping Neon database (or a stale pooled socket) fails the first attempt; retry before
    // reporting "down", otherwise the first visitor after a quiet period sees a false outage.
    probe: () => retryingProbe(() => getPool().query("SELECT 1")),
    timeoutMs: 12_000,
  });
  return NextResponse.json(report, { status: report.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
