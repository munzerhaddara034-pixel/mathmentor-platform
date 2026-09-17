import { NextResponse } from "next/server";
import { findUserByEmail, asPublicUser, userAccess } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/passwords";
import { startExclusiveSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/auth/paths";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; next?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; next?: string };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON.", errorAr: "JSON غير صالح." },
      { status: 400 },
    );
  }
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required.", errorAr: "البريد وكلمة المرور مطلوبان." },
      { status: 400 },
    );
  }
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      {
        error: "Wrong email or password.",
        errorAr: "البريد أو كلمة المرور غير صحيحة.",
      },
      { status: 401 },
    );
  }
  await startExclusiveSession(user.id, request.headers.get("user-agent") ?? undefined);
  const publicUser = asPublicUser(user);
  const access = await userAccess(user);
  const requested = body.next && body.next.startsWith("/") ? body.next : "";
  let redirectTo = requested || (access.aiAccess ? "/lessons/interactive" : access.liveAccess ? "/live" : "/redeem");
  if (isStaffRole(user.role) && (!requested || requested === "/lessons/interactive")) {
    redirectTo = requested || "/studio/script";
  } else if (!isStaffRole(user.role) && !access.aiAccess && !access.liveAccess) {
    redirectTo = `/redeem?need=subscription${requested ? `&next=${encodeURIComponent(requested)}` : ""}`;
  } else if (!isStaffRole(user.role) && requested.startsWith("/live") && !access.liveAccess) {
    redirectTo = `/subscribe?need=live&next=${encodeURIComponent(requested)}`;
  } else if (!isStaffRole(user.role) && (requested.startsWith("/math-solver") || requested.startsWith("/lessons")) && !access.aiAccess) {
    redirectTo = `/redeem?need=ai&next=${encodeURIComponent(requested)}`;
  }
  return NextResponse.json({
    ok: true,
    user: publicUser,
    redirectTo,
    notice: "This sign-in replaced any previous device session.",
    noticeAr: "ألغى هذا الدخول أي جلسة سابقة على جهاز آخر.",
  });
}
