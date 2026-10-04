import { NextResponse } from "next/server";
import { apiSession } from "@/lib/auth/guards";
import { createSubscribeOrder, type SubscribePeriod } from "@/lib/billing/orders";
import { whishEnabled } from "@/lib/whish/client";
import {
  isPaymentMethod,
  isPricingRegion,
  type PaymentMethod,
  type PricingRegion,
} from "@/lib/pricing/plans";
import { paymentMethodLabel } from "@/lib/pricing/transfers";

export const runtime = "nodejs";

type Body = {
  planId?: string;
  period?: SubscribePeriod;
  region?: PricingRegion;
  paymentMethod?: PaymentMethod;
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

    const planId = body.planId?.trim();
    const period = body.period;
    const region = isPricingRegion(body.region) ? body.region : undefined;
    const paymentMethod: PaymentMethod = isPaymentMethod(body.paymentMethod)
      ? body.paymentMethod
      : region === "lebanon" || !region
        ? "whish"
        : "western_union";

    if (!planId) {
      return NextResponse.json({ error: "planId required.", errorAr: "معرّف الباقة مطلوب." }, { status: 400 });
    }
    if (period !== "monthly" && period !== "term") {
      return NextResponse.json(
        { error: 'period must be "monthly" or "term".', errorAr: "الفترة يجب أن تكون شهري أو فصل." },
        { status: 400 },
      );
    }

    if (paymentMethod === "whish" && !whishEnabled()) {
      return NextResponse.json(
        { error: "Whish payments are disabled.", errorAr: "دفع Whish معطّل." },
        { status: 503 },
      );
    }

    const result = await createSubscribeOrder({
      userId: user.id,
      studentName: user.name,
      studentPhone: user.contactPhone || "", // never the display fallback number
      planId,
      period,
      region,
      paymentMethod,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, errorAr: result.errorAr }, { status: 400 });
    }

    const methodLabel = paymentMethodLabel(paymentMethod);

    try {
      const { notifyStaff, pushNotification } = await import("@/lib/notifications/store");
      await notifyStaff({
        kind: "live_booked",
        title: `${user.name} requested ${result.order.planName} (${period}) · $${result.order.amount} via ${methodLabel.en}`,
        titleAr: `${user.name} طلب ${result.order.planNameAr} (${period === "monthly" ? "شهري" : "فصل"}) · $${result.order.amount} عبر ${methodLabel.ar}`,
        body: `${methodLabel.en} order ${result.order.id} — awaiting transfer.`,
        bodyAr: `طلب ${methodLabel.ar} ${result.order.id} — بانتظار التحويل.`,
        href: "/subscribe",
        relatedId: result.order.id,
      });
      await pushNotification({
        userId: user.id,
        audience: "student",
        kind: "live_booked",
        title: `Subscription pending — transfer via ${methodLabel.en}`,
        titleAr: `الاشتراك معلّق — حوّل عبر ${methodLabel.ar}`,
        body: result.instructions.linesEn[0] || `Transfer $${result.order.amount}.`,
        bodyAr: result.instructions.linesAr[0] || `حوّل $${result.order.amount}.`,
        href: "/subscribe",
        relatedId: `stu-${result.order.id}`,
      });
    } catch {
      /* optional */
    }

    try {
      const { notifySubscribeRequest } = await import("@/lib/whatsapp/notify");
      await notifySubscribeRequest(result.order);
    } catch {
      /* WhatsApp optional */
    }

    return NextResponse.json({
      ok: true,
      pendingPayment: true,
      order: result.order,
      transfer: result.transfer,
      instructions: result.instructions,
      paymentMethod,
      price: {
        amount: result.price.amount,
        currency: result.price.currency,
        display: result.price.display,
        displayAr: result.price.displayAr,
        configured: result.price.configured,
      },
      message: `Order created. Transfer via ${methodLabel.en}, then tap I've transferred.`,
      messageAr: `تم إنشاء الطلب. حوّل عبر ${methodLabel.ar} ثم اضغط لقد حوّلت.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Subscribe request failed." },
      { status: 500 },
    );
  }
}
