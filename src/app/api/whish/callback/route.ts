import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Merchant Whish API callbacks are not used.
 * All checkout is a manual transfer to WHISH_TRANSFER_PHONE; confirmation is
 * POST /api/live/confirm-payment (live) or POST /api/billing/confirm-payment (subscriptions).
 */
export async function GET() {
  return NextResponse.json({
    ok: false,
    message:
      "Whish merchant callbacks are disabled. Use manual transfer + /api/live/confirm-payment or /api/billing/confirm-payment.",
    messageAr:
      "استدعاءات Whish للتجار معطّلة. استخدم التحويل اليدوي و /api/live/confirm-payment أو /api/billing/confirm-payment.",
  });
}

export async function POST() {
  return GET();
}
