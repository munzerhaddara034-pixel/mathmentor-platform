import { NextResponse } from "next/server";
import { endCurrentSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await endCurrentSession();
  return NextResponse.json({ ok: true });
}
