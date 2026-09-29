import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { listOrders } from "@/lib/billing/orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const guard = await apiSession();
    if (guard.error) return guard.error;
    const user = guard.live.user;
    const staff = isStaffRole(user.role);
    const url = new URL(request.url);
    const pendingOnly = url.searchParams.get("pending") === "1";

    const orders = staff
      ? await listOrders({ pendingOnly: pendingOnly || undefined })
      : await listOrders({ userId: user.id, pendingOnly: pendingOnly || undefined });

    return NextResponse.json({ ok: true, orders, staff });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list orders." },
      { status: 500 },
    );
  }
}
