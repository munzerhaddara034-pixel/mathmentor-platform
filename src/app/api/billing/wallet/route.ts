import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isSessionSharingExempt, isStaffRole } from "@/lib/auth/paths";
import { listUserSessions, userAccess } from "@/lib/auth/store";
import { listLedger, walletSnapshot } from "@/lib/billing/store";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const snap = await walletSnapshot(guard.live.user.id);
  if (!snap) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const access = isStaffRole(guard.live.user.role)
    ? { aiAccess: true, liveAccess: true, liveCredits: guard.live.user.liveCredits }
    : await userAccess(guard.live.user);
  const devices = await listUserSessions(guard.live.user.id);
  return NextResponse.json({
    ...snap,
    aiAccess: access.aiAccess,
    liveAccess: access.liveAccess,
    liveCredits: access.liveCredits,
    devices: devices.map((device) => ({ ...device, current: device.id === guard.live.sessionId })),
    sharingExempt: isSessionSharingExempt(guard.live.user),
    ledger: await listLedger(guard.live.user.id),
  });
}
