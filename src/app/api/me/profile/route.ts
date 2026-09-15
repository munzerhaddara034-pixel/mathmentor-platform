import { NextResponse } from "next/server";
import { requireSession, setSessionCookie } from "@/lib/auth/server";
import { updateUserProfile } from "@/lib/auth/db";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const gate = await requireSession();
  if (!gate.ok) return gate.error;
  const body = (await request.json()) as { name?: string; phone?: string };
  const user = updateUserProfile(gate.user.id, {
    name: body.name,
    phone: body.phone,
  });
  if (!user) return NextResponse.json({ error: "تعذر حفظ الملف" }, { status: 400 });
  await setSessionCookie(user);
  return NextResponse.json({ user });
}
