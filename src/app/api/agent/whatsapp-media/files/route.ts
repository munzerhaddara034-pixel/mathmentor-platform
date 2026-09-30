/** Staff API: list WhatsApp media records (inbound + outbound). */
import { NextResponse } from "next/server";
import { requireStaffOrSecret } from "@/lib/agent/media/strictAuth";
import { listMediaRecords } from "@/lib/whatsapp/media/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireStaffOrSecret(request);
  if (!auth.ok) return auth.error;
  try {
    const limit = Number(new URL(request.url).searchParams.get("limit") || "50");
    const files = await listMediaRecords(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ ok: true, files });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "list failed" }, { status: 500 });
  }
}
