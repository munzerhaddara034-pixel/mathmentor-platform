import { NextResponse } from "next/server";
import { buildRoleDashboard } from "@/lib/auth/dashboard";
import { requireSession } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function GET() {
  const result = await requireSession();
  if (!result.ok) return result.error;
  return NextResponse.json(buildRoleDashboard(result.user));
}
