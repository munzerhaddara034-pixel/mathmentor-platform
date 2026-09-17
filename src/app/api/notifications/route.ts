import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { listNotifications, markAllRead, unreadCount } from "@/lib/notifications/store";
import { ensureUpcomingLiveAlerts } from "@/lib/notifications/liveReminders";

export const runtime = "nodejs";

export async function GET() {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  await ensureUpcomingLiveAlerts();
  const notifications = await listNotifications(guard.live.user.id);
  return NextResponse.json({
    notifications: notifications.slice(0, 30),
    unread: notifications.filter((item) => !item.read).length,
  });
}

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "read-all") {
    await markAllRead(guard.live.user.id);
  }
  return NextResponse.json({ ok: true, unread: await unreadCount(guard.live.user.id) });
}
