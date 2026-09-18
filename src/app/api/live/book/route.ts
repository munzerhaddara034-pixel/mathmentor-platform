import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { adjustLiveCredits, userHasLiveAccess } from "@/lib/auth/store";
import { bookSlot } from "@/lib/live/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await apiSession();
  if (guard.error) return guard.error;
  const user = guard.live.user;
  if (!isStaffRole(user.role) && !(await userHasLiveAccess(user))) {
    return NextResponse.json({ error: "LIVE_TIER or BOTH required.", errorAr: "يلزم اشتراك الحصص المباشرة." }, { status: 403 });
  }
  if (!isStaffRole(user.role) && (user.liveCredits ?? 0) < 1) {
    return NextResponse.json(
      { error: "No live credits left. Redeem a live card or buy more sessions.", errorAr: "لا رصيد حصص مباشرة. فعّل بطاقة مباشرة." },
      { status: 402 },
    );
  }

  const body = (await request.json()) as { slotId?: string };
  if (!body.slotId) return NextResponse.json({ error: "slotId required." }, { status: 400 });

  const result = await bookSlot({
    slotId: body.slotId,
    studentId: user.id,
    studentName: user.name,
    studentEmail: user.email,
    studentPhone: user.phone,
  });
  if (!result.ok) return NextResponse.json({ error: result.error, errorAr: result.errorAr }, { status: 400 });

  if (!isStaffRole(user.role)) {
    await adjustLiveCredits(user.id, -1);
    const { recordLiveBookingDebit } = await import("@/lib/billing/store");
    await recordLiveBookingDebit(user.id, result.booking.id, user.name);
  }
  const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
  await notifyStaff({
    kind: "live_booked",
    title: `${user.name} booked a live session`,
    titleAr: `${user.name} حجز حصة مباشرة`,
    body: new Date(result.booking.startsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }),
    bodyAr: `${user.name} حجز موعداً.`,
    href: "/live",
    relatedId: result.booking.id,
  });
  await pushNotification({
    userId: user.id,
    audience: "student",
    kind: "live_booked",
    title: "Live session confirmed",
    titleAr: "تم تأكيد الحصة المباشرة",
    body: result.booking.classroomUrl || result.booking.meetingLink || "See /live for the join link.",
    bodyAr: "اضغط انضم للحصة من صفحة المباشر.",
    href: result.booking.classroomUrl || "/live",
    relatedId: `stu-${result.booking.id}`,
  });

  return NextResponse.json({
    ok: true,
    booking: result.booking,
    meetingLink: result.booking.meetingLink,
    classroomUrl: result.booking.classroomUrl,
    message: "Booked. 1 live credit used. Join the classroom from your calendar.",
    messageAr: "تم الحجز. خُصم رصيد حصة واحدة. انضم للحصة من رزنامتك.",
  });
}
