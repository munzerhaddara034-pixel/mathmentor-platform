/**
 * Read-only finance aggregates for the CFO agent: `Authorization: Bearer <MM_FINANCE_READ_TOKEN>`.
 * Same payload as /api/admin/finance/summary (aggregates only). Separate from the admin session route.
 */
import { getFinanceSummary } from "@/lib/payments/db";
import { paymentsAvailable, paymentsPool } from "@/lib/payments/service";
import { financeMethodNotAllowed, handleFinanceSummaryRequest } from "@/lib/finance/readToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleFinanceSummaryRequest(request, {
    databaseAvailable: paymentsAvailable,
    loadSummary: async () => getFinanceSummary(await paymentsPool()),
  });
}

export async function POST() {
  return financeMethodNotAllowed();
}
export const PUT = POST;
export const PATCH = POST;
export const DELETE = POST;
