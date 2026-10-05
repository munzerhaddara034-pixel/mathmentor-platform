/** Admin-only read-only finance aggregates (no receipts, no payment rows, no PII). */
import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth/guards";
import { getFinanceSummary } from "@/lib/payments/db";
import { paymentErrorResponse, unavailableResponse } from "@/lib/payments/http";
import { paymentsAvailable, paymentsPool } from "@/lib/payments/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!paymentsAvailable()) return unavailableResponse();
  try {
    const pool = await paymentsPool();
    const summary = await getFinanceSummary(pool);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
