import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { adjustLiveCredits, findUserById } from "@/lib/auth/store";
import { confirmPaidBooking, getBooking, patchBooking } from "@/lib/live/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const guard = await apiSession();
    if (guard.error) return guard.error;
    const user = guard.live.user;

    let body: { bookingId?: string; action?: "student_mark" | "teacher_confirm" };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (!body.bookingId) return NextResponse.json({ error: "bookingId required." }, { status: 400 });

    const booking = await getBooking(body.bookingId);
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

    const staff = isStaffRole(user.role);
    const isOwner = booking.studentId === user.id;
    if (!staff && !isOwner) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const action = body.action || (staff ? "teacher_confirm" : "student_mark");

    if (action === "student_mark") {
      const updated = await patchBooking(booking.id, {
        studentMarkedPaidAt: new Date().toISOString(),
        paymentProvider: "manual",
      });
      try {
        const { notifyLiveBooked } = await import("@/lib/whatsapp/notify");
        await notifyLiveBooked({
          ...(updated || booking),
          status: "pending_payment",
          paymentStatus: "pending",
        });
      } catch {
        /* optional */
      }
      try {
        const { notifyStaff } = await import("@/lib/notifications/store");
        await notifyStaff({
          kind: "live_booked",
          title: `${booking.studentName} marked Whish transfer sent`,
          titleAr: `${booking.studentName} أكّد إرسال تحويل Whish`,
          body: `Booking ${booking.id} — please verify and confirm.`,
          bodyAr: `الحجز ${booking.id} — يرجى التحقق والتأكيد.`,
          href: "/live",
          relatedId: booking.id,
        });
      } catch {
        /* optional */
      }
      return NextResponse.json({
        ok: true,
        marked: true,
        booking: updated || booking,
        message: "Marked as transferred. Waiting for teacher confirmation.",
        messageAr: "تم تسجيل التحويل. بانتظار تأكيد الأستاذ.",
      });
    }

    const confirmed = await confirmPaidBooking(booking.id, { paymentProvider: "manual" });
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.error }, { status: 400 });
    }

    if (!confirmed.alreadyPaid && !confirmed.booking.creditDeducted) {
      const student = await findUserById(confirmed.booking.studentId);
      if (student && !isStaffRole(student.role) && (student.liveCredits ?? 0) >= 1) {
        await adjustLiveCredits(student.id, -1);
        try {
          const { recordLiveBookingDebit } = await import("@/lib/billing/store");
          await recordLiveBookingDebit(student.id, confirmed.booking.id, student.name);
        } catch {
          /* optional */
        }
      }
      await patchBooking(confirmed.booking.id, { creditDeducted: true });
    }

    const fresh = (await getBooking(confirmed.booking.id)) || confirmed.booking;
    if (!confirmed.alreadyPaid) {
      try {
        const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
        await notifyStaff({
          kind: "live_booked",
          title: `${fresh.studentName} live confirmed (Whish)`,
          titleAr: `تم تأكيد حصة ${fresh.studentName} (Whish)`,
          body: new Date(fresh.startsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }),
          bodyAr: "تم تأكيد الدفع.",
          href: "/live",
          relatedId: fresh.id,
        });
        await pushNotification({
          userId: fresh.studentId,
          audience: "student",
          kind: "live_booked",
          title: "Live session confirmed",
          titleAr: "تم تأكيد الحصة المباشرة",
          body: fresh.classroomUrl || fresh.meetingLink || "See /live",
          bodyAr: "اضغط انضم للحصة من صفحة المباشر.",
          href: fresh.classroomUrl || "/live",
          relatedId: `stu-${fresh.id}`,
        });
      } catch {
        /* optional */
      }
      try {
        const { notifyLiveBooked } = await import("@/lib/whatsapp/notify");
        await notifyLiveBooked(fresh);
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({
      ok: true,
      confirmed: true,
      alreadyPaid: confirmed.alreadyPaid,
      booking: fresh,
      message: "Payment confirmed. Session is booked.",
      messageAr: "تم تأكيد الدفع. الحصة محجوزة.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed." },
      { status: 500 },
    );
  }
}
