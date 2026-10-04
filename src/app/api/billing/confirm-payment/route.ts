import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { isStaffRole } from "@/lib/auth/paths";
import { isVerifiedAdmin } from "@/lib/payments/http";
import { appendAuditLog } from "@/lib/security/audit";
import { clientIpFrom } from "@/lib/security/rateLimit";
import { isSameOriginRequest } from "@/lib/security/origin";
import {
  confirmSubscribePayment,
  getOrder,
  markTransferClaimed,
} from "@/lib/billing/orders";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  action?: "student_mark" | "teacher_confirm";
};

export async function POST(request: Request) {
  try {
    const guard = await apiSession();
    if (guard.error) return guard.error;
    const user = guard.live.user;

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (!body.orderId) {
      return NextResponse.json({ error: "orderId required." }, { status: 400 });
    }

    const order = await getOrder(body.orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found.", errorAr: "الطلب غير موجود." }, { status: 404 });
    }

    const staff = isStaffRole(user.role);
    const isOwner = order.userId === user.id;
    if (!staff && !isOwner) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    // Activation is admin-only (owner decision 2026-10): teachers may view/mark but never activate.
    const admin = isVerifiedAdmin(user);
    const action = body.action || (admin ? "teacher_confirm" : "student_mark");

    if (action === "student_mark") {
      if (!isOwner && !staff) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
      const marked = await markTransferClaimed(order.id);
      if (!marked.ok) {
        return NextResponse.json({ error: marked.error, errorAr: marked.errorAr }, { status: 400 });
      }

      try {
        const { notifySubscribeRequest } = await import("@/lib/whatsapp/notify");
        await notifySubscribeRequest(marked.order, { transferClaimed: true });
      } catch {
        /* optional */
      }
      try {
        const { notifyStaff } = await import("@/lib/notifications/store");
        await notifyStaff({
          kind: "live_booked",
          title: `${order.studentName} marked Whish transfer (subscription)`,
          titleAr: `${order.studentName} أكّد تحويل Whish (اشتراك)`,
          body: `Order ${order.id} · $${order.amount} · ${order.planName} — please verify and confirm.`,
          bodyAr: `الطلب ${order.id} · $${order.amount} · ${order.planNameAr} — يرجى التحقق والتأكيد.`,
          href: "/subscribe",
          relatedId: order.id,
        });
      } catch {
        /* optional */
      }

      return NextResponse.json({
        ok: true,
        marked: true,
        order: marked.order,
        message: "Marked as transferred. Waiting for teacher confirmation.",
        messageAr: "تم تسجيل التحويل. بانتظار تأكيد الأستاذ.",
      });
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Only the admin can confirm a payment.", errorAr: "تأكيد الدفع للمدير فقط." },
        { status: 403 },
      );
    }
    if (!isSameOriginRequest(request.headers)) {
      return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
    }

    const confirmed = await confirmSubscribePayment(order.id, user.id);
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.error, errorAr: confirmed.errorAr }, { status: 400 });
    }
    await appendAuditLog({
      action: "billing.order.confirm",
      actor: { id: user.id, email: user.email, role: user.role },
      target: order.id,
      ip: clientIpFrom(request.headers),
      details: { alreadyPaid: confirmed.alreadyPaid, planId: confirmed.order.planId, amount: confirmed.order.amount },
    }).catch((error: unknown) => console.error("[mathmentor][audit] billing.order.confirm failed", error instanceof Error ? error.message : error));

    if (!confirmed.alreadyPaid) {
      try {
        const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
        await notifyStaff({
          kind: "live_booked",
          title: `${confirmed.order.studentName} subscription confirmed (Whish)`,
          titleAr: `تم تأكيد اشتراك ${confirmed.order.studentName} (Whish)`,
          body: `${confirmed.order.planName} · $${confirmed.order.amount}`,
          bodyAr: `${confirmed.order.planNameAr} · $${confirmed.order.amount}`,
          href: "/subscribe",
          relatedId: confirmed.order.id,
        });
        await pushNotification({
          userId: confirmed.order.userId,
          audience: "student",
          kind: "live_booked",
          title: "Subscription activated",
          titleAr: "تم تفعيل الاشتراك",
          body: `${confirmed.order.planName} is active.`,
          bodyAr: `تم تفعيل ${confirmed.order.planNameAr}.`,
          href: "/wallet",
          relatedId: `stu-${confirmed.order.id}`,
        });
      } catch {
        /* optional */
      }
      try {
        // Only the student's own saved phone: never fall back to the confirming admin's phone.
        const studentPhone = confirmed.order.studentPhone?.trim();
        const { notifyActivation } = await import("@/lib/whatsapp/notify");
        if (studentPhone) await notifyActivation({
          phone: studentPhone,
          name: confirmed.order.studentName,
          planName: confirmed.order.planNameAr || confirmed.order.planName,
          code: `WHISH-${confirmed.order.id}`,
          userId: confirmed.order.userId,
        });
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({
      ok: true,
      confirmed: true,
      alreadyPaid: confirmed.alreadyPaid,
      order: confirmed.order,
      message: "Payment confirmed. Plan activated.",
      messageAr: "تم تأكيد الدفع. تم تفعيل الباقة.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed." },
      { status: 500 },
    );
  }
}
