import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { consumeLiveCredit, userAccess, userHasLiveAccess } from "@/lib/auth/store";
import { createId } from "@/lib/ids";
import { bookSlot, patchBooking } from "@/lib/live/store";
import {
  liveSessionPriceFor,
  type PricingTier,
  whishEnabled,
  whishTransferInstructions,
} from "@/lib/whish/client";

export const runtime = "nodejs";

type GuestBody = {
  name?: string;
  phone?: string;
  email?: string;
};

type BookBody = {
  slotId?: string;
  guest?: GuestBody;
  pricingTier?: PricingTier;
};

function normalizePhone(value: string) {
  return value.replace(/[\s\-()]/g, "").trim();
}

function resolveTier(opts: {
  staff: boolean;
  loggedIn: boolean;
  hasLiveAccess: boolean;
  hasPlatformPlan: boolean;
  requested?: PricingTier;
  hasGuestPayload: boolean;
}): PricingTier {
  if (opts.staff) return "member";
  if (opts.requested === "external") return "external";
  if (!opts.loggedIn || opts.hasGuestPayload) {
    // Guests always external unless they are signed-in members booking without guest form.
    if (!opts.loggedIn) return "external";
  }
  if (opts.requested === "member") {
    return opts.loggedIn && (opts.hasLiveAccess || opts.hasPlatformPlan) ? "member" : "external";
  }
  // Prefer: members with live access (or any active platform plan) → 15; else → 25.
  if (opts.loggedIn && (opts.hasLiveAccess || opts.hasPlatformPlan) && !opts.hasGuestPayload) {
    return "member";
  }
  return "external";
}

export async function POST(request: Request) {
  try {
    const live = await getLiveSession();
    const loggedIn = live.ok;
    const user = live.ok ? live.user : null;
    const staff = Boolean(user && isStaffRole(user.role));

    let body: BookBody;
    try {
      body = (await request.json()) as BookBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    if (!body.slotId) return NextResponse.json({ error: "slotId required." }, { status: 400 });

    const guest = body.guest;
    const hasGuestPayload = Boolean(guest?.name?.trim() && guest?.phone?.trim());

    let hasLiveAccess = false;
    let hasPlatformPlan = false;
    if (user && !staff) {
      hasLiveAccess = await userHasLiveAccess(user);
      const access = await userAccess(user);
      const tier = access.subscriptionType;
      hasPlatformPlan = tier === "AI_TIER" || tier === "LIVE_TIER" || tier === "BOTH";
    }

    const pricingTier = resolveTier({
      staff,
      loggedIn,
      hasLiveAccess,
      hasPlatformPlan,
      requested: body.pricingTier,
      hasGuestPayload: hasGuestPayload && body.pricingTier === "external",
    });

    if (!loggedIn) {
      const name = guest?.name?.trim() || "";
      const phone = normalizePhone(guest?.phone || "");
      if (!name || !phone) {
        return NextResponse.json(
          {
            error: "Guest booking requires name and phone.",
            errorAr: "حجز الزائر يتطلب الاسم ورقم الهاتف.",
          },
          { status: 400 },
        );
      }
    }

    if (!staff && pricingTier === "external") {
      const phone = normalizePhone(guest?.phone || user?.contactPhone || "");
      const name = guest?.name?.trim() || user?.name || "";
      if (!phone || !name) {
        return NextResponse.json(
          {
            error: "Name and phone required for outside-platform booking.",
            errorAr: "الاسم ورقم الهاتف مطلوبان للحجز خارج المنصة.",
          },
          { status: 400 },
        );
      }
    }

    const paymentFlow = !staff && whishEnabled();
    const price = liveSessionPriceFor(pricingTier);
    const transfer = whishTransferInstructions(pricingTier);

    const studentName = guest?.name?.trim() || user?.name || "Guest";
    // contactPhone, not phone: `phone` carries a display fallback that must never receive WhatsApp.
    const studentPhone = normalizePhone(guest?.phone || user?.contactPhone || "");
    const studentEmail = (guest?.email?.trim() || user?.email || "").toLowerCase();
    const studentId = user?.id || createId("guest");

    const result = await bookSlot({
      slotId: body.slotId,
      studentId,
      studentName,
      studentEmail,
      studentPhone,
      status: paymentFlow ? "pending_payment" : "confirmed",
      paymentStatus: paymentFlow ? "pending" : "none",
      paymentProvider: paymentFlow ? "manual" : "none",
      paymentAmount: paymentFlow && price.configured ? price.amount : undefined,
      paymentCurrency: paymentFlow && price.configured ? price.currency : undefined,
      pricingTier: paymentFlow ? pricingTier : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, errorAr: result.errorAr }, { status: 400 });
    }

    if (paymentFlow) {
      try {
        const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
        await notifyStaff({
          kind: "live_booked",
          title: `${studentName} requested live (awaiting Whish · $${price.amount})`,
          titleAr: `${studentName} طلب حصة (بانتظار Whish · $${price.amount})`,
          body: `${new Date(result.booking.startsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })} · ${price.display}`,
          bodyAr: `${studentName} بانتظار تحويل Whish ${price.displayAr}.`,
          href: "/live",
          relatedId: result.booking.id,
        });
        if (user) {
          await pushNotification({
            userId: user.id,
            audience: "student",
            kind: "live_booked",
            title: "Booking held — transfer via Whish",
            titleAr: "الحجز معلّق — حوّل عبر Whish",
            body: `Transfer ${price.display} to ${transfer.phone} (${transfer.nameAr}).`,
            bodyAr: `حوّل ${price.displayAr} إلى ${transfer.phone} (${transfer.nameAr}).`,
            href: "/live",
            relatedId: `stu-${result.booking.id}`,
          });
        }
      } catch {
        /* optional */
      }

      try {
        const { notifyLiveBooked } = await import("@/lib/whatsapp/notify");
        await notifyLiveBooked(result.booking);
      } catch {
        /* WhatsApp optional — booking still held */
      }

      return NextResponse.json({
        ok: true,
        pendingPayment: true,
        pricingTier,
        booking: result.booking,
        transfer,
        price: {
          amount: price.amount,
          currency: price.currency,
          display: price.display,
          displayAr: price.displayAr,
          configured: price.configured,
          tier: price.tier,
        },
        message: "Booking held. Transfer via Whish, then tap I've transferred.",
        messageAr: "تم تعليق الحجز. حوّل عبر Whish ثم اضغط لقد حوّلت.",
      });
    }

    if (!staff && user) {
      // Atomic spend: two parallel bookings can no longer both take the last remaining hour.
      const spent = await consumeLiveCredit(user.id);
      if (spent.ok) {
        try {
          const { recordLiveBookingDebit } = await import("@/lib/billing/store");
          await recordLiveBookingDebit(user.id, result.booking.id, user.name);
        } catch {
          /* optional */
        }
        await patchBooking(result.booking.id, { creditDeducted: true });
      } else {
        console.warn("[mathmentor] live booking without a live credit", {
          userId: user.id,
          bookingId: result.booking.id,
          reason: spent.reason,
        });
      }
    }

    try {
      const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
      await notifyStaff({
        kind: "live_booked",
        title: `${studentName} booked a live session`,
        titleAr: `${studentName} حجز حصة مباشرة`,
        body: new Date(result.booking.startsAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" }),
        bodyAr: `${studentName} حجز موعداً.`,
        href: "/live",
        relatedId: result.booking.id,
      });
      if (user) {
        await pushNotification({
          userId: user.id,
          audience: "student",
          kind: "live_booked",
          title: "Live session confirmed",
          titleAr: "تم تأكيد الحصة المباشرة",
          body: result.booking.classroomUrl || result.booking.meetingLink || "See /live",
          bodyAr: "اضغط انضم للحصة من صفحة المباشر.",
          href: result.booking.classroomUrl || "/live",
          relatedId: `stu-${result.booking.id}`,
        });
      }
    } catch {
      /* optional */
    }

    try {
      const { notifyLiveBooked } = await import("@/lib/whatsapp/notify");
      await notifyLiveBooked(result.booking);
    } catch {
      /* optional */
    }

    return NextResponse.json({
      ok: true,
      pendingPayment: false,
      pricingTier,
      booking: result.booking,
      meetingLink: result.booking.meetingLink,
      classroomUrl: result.booking.classroomUrl,
      message: "Booked. Join from your calendar.",
      messageAr: "تم الحجز. انضم من رزنامتك.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Booking failed." },
      { status: 500 },
    );
  }
}
