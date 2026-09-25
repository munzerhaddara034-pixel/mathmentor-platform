import { NextResponse } from "next/server";
import { getFreshSession } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getFreshSession();
  return NextResponse.json({ user });
}
