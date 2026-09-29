import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";
import { userAccess, userHasLiveAccess } from "@/lib/auth/store";
import { addSlot, availableSlots, getAvailability, listBookings, listSlots, removeSlot } from "@/lib/live/store";
import {
  dualLiveSessionPrices,
  liveSessionPriceFor,
  type PricingTier,
  whishTransferInstructions,
} from "@/lib/whish/client";

export const runtime = "nodejs";

function pricePayload(tier: PricingTier) {
  const price = liveSessionPriceFor(tier);
  return {
    amount: price.amount,
    currency: price.currency,
    display: price.display,
    displayAr: price.displayAr,
    configured: price.configured,
    tier: price.tier,
  };
}

export async function GET() {
  try {
    const live = await getLiveSession();
    const staff = live.ok && isStaffRole(live.user.role);
    const dual = dualLiveSessionPrices();

    let pricingTier: PricingTier = "external";
    let hasLiveAccess = false;
    let hasPlatformPlan = false;
    let credits = 0;

    if (live.ok) {
      credits = live.user.liveCredits ?? 0;
      if (staff) {
        hasLiveAccess = true;
        hasPlatformPlan = true;
        pricingTier = "member";
      } else {
        hasLiveAccess = await userHasLiveAccess(live.user);
        const access = await userAccess(live.user);
        const tier = access.subscriptionType;
        hasPlatformPlan = tier === "AI_TIER" || tier === "LIVE_TIER" || tier === "BOTH";
        pricingTier = hasLiveAccess || hasPlatformPlan ? "member" : "external";
      }
    }

    // Guests and any visitor can list open slots (no LIVE_TIER gate).
    const slots = staff ? await listSlots() : await availableSlots();
    const bookings = live.ok
      ? await listBookings(staff ? undefined : { studentId: live.user.id })
      : [];
    const availability = await getAvailability();
    const price = liveSessionPriceFor(pricingTier);
    const transfer = whishTransferInstructions(pricingTier);

    return NextResponse.json({
      slots,
      bookings,
      availability,
      liveCredits: credits,
      timezone: availability.timezone,
      authenticated: live.ok,
      staff: Boolean(staff),
      hasLiveAccess,
      hasPlatformPlan,
      pricingTier,
      price: pricePayload(pricingTier),
      prices: {
        member: pricePayload("member"),
        external: pricePayload("external"),
        bannerEn: dual.bannerEn,
        bannerAr: dual.bannerAr,
      },
      transfer,
      transferMember: whishTransferInstructions("member"),
      transferExternal: whishTransferInstructions("external"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load slots." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const live = await getLiveSession();
  if (!live.ok) {
    return NextResponse.json({ error: "Sign in required.", errorAr: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  if (!isStaffRole(live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const body = (await request.json()) as { startsAt?: string; durationMinutes?: number; capacity?: number; note?: string };
  if (!body.startsAt) return NextResponse.json({ error: "startsAt required." }, { status: 400 });
  const slot = await addSlot({
    startsAt: body.startsAt,
    durationMinutes: body.durationMinutes,
    capacity: body.capacity,
    note: body.note,
  });
  return NextResponse.json({ slot });
}

export async function DELETE(request: Request) {
  const live = await getLiveSession();
  if (!live.ok) {
    return NextResponse.json({ error: "Sign in required.", errorAr: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  if (!isStaffRole(live.user.role)) {
    return NextResponse.json({ error: "Staff only." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
  await removeSlot(id);
  return NextResponse.json({ ok: true });
}
