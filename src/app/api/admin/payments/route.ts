/** Admin-only list of payment claims (pending first). Teachers and students get 403. */
import { NextResponse } from "next/server";
import { apiRequireAdmin } from "@/lib/auth/guards";
import { listPublicUsers } from "@/lib/auth/store";
import { countPending, listPaymentsForAdmin } from "@/lib/payments/db";
import { maybePurgeReceipts, paymentsAvailable, paymentsPool } from "@/lib/payments/service";
import { paymentErrorResponse, unavailableResponse } from "@/lib/payments/http";
import { isPaymentStatus } from "@/lib/payments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await apiRequireAdmin();
  if (guard.error) return guard.error;
  if (!paymentsAvailable()) return unavailableResponse();
  const url = new URL(request.url);
  const raw = url.searchParams.get("status") || "pending";
  const status = isPaymentStatus(raw) ? raw : "pending";
  try {
    const pool = await paymentsPool();
    await maybePurgeReceipts(pool);
    const [payments, pending, users] = await Promise.all([
      listPaymentsForAdmin(pool, { status }),
      countPending(pool),
      listPublicUsers(),
    ]);
    const expiries = new Map(users.map((user) => [user.id, user.aiExpiresAt]));
    return NextResponse.json({
      ok: true,
      status,
      pendingCount: pending,
      payments: payments.map((payment) => ({ ...payment, currentAiExpiresAt: expiries.get(payment.userId) ?? null })),
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
