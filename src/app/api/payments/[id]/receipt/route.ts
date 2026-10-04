/** Receipt image: visible to the student who uploaded it and to the verified admin only. */
import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { getReceipt } from "@/lib/payments/db";
import { paymentsAvailable, paymentsPool } from "@/lib/payments/service";
import { actorOf, isVerifiedAdmin, paymentErrorResponse, unavailableResponse } from "@/lib/payments/http";
import { appendAuditLog } from "@/lib/security/audit";
import { clientIpFrom } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  if (!paymentsAvailable()) return unavailableResponse();
  const { id } = await params;
  const user = guard.live.user;
  try {
    const receipt = await getReceipt(await paymentsPool(), id);
    const admin = isVerifiedAdmin(user);
    if (!receipt || (!admin && receipt.userId !== user.id)) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    if (receipt.purged || !receipt.bytes) {
      return NextResponse.json({ ok: false, error: "Receipt removed after the 12-month retention period." }, { status: 410 });
    }
    if (admin) {
      await appendAuditLog({ action: "payment.receipt.view", actor: actorOf(user), target: id, ip: clientIpFrom(request.headers) }).catch(() => undefined);
    }
    const ext = receipt.mimeType === "image/png" ? "png" : receipt.mimeType === "image/webp" ? "webp" : "jpg";
    return new Response(new Uint8Array(receipt.bytes), {
      status: 200,
      headers: {
        "Content-Type": receipt.mimeType,
        "Content-Length": String(receipt.bytes.length),
        "Content-Disposition": `inline; filename="receipt-${id.replace(/[^\w.-]/g, "")}.${ext}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      },
    });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
