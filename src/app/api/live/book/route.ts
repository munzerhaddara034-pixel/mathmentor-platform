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
  }

  return NextResponse.json({
    ok: true,
    booking: result.booking,
    message: "Requested. Prof. Munzer Haddara will confirm and add a meeting link.",
    messageAr: "تم الطلب. يؤكد الأستاذ منذر حداره الموعد ويضع رابط اللقاء.",
  });
}
