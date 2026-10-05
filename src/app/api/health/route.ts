import { NextResponse } from "next/server";
import { getPool, isPostgresEnabled } from "@/lib/db/pg";
import { healthReport } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public health probe: 200 when healthy, 503 when the database is configured but unreachable. */
export async function GET() {
  const report = await healthReport({
    dbEnabled: isPostgresEnabled(),
    probe: () => getPool().query("SELECT 1"),
    timeoutMs: 3000,
  });
  return NextResponse.json(report, { status: report.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
