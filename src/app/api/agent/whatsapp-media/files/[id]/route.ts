/** Staff API: download one stored WhatsApp media file. */
import { NextResponse } from "next/server";
import { requireStaffOrSecret } from "@/lib/agent/media/strictAuth";
import { getMediaRecord, readMediaBytes } from "@/lib/whatsapp/media/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffOrSecret(request);
  if (!auth.ok) return auth.error;
  try {
    const { id } = await context.params;
    const record = await getMediaRecord(id);
    if (!record) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const bytes = await readMediaBytes(record);
    if (!bytes) {
      return NextResponse.json(
        { ok: false, error: "file bytes missing (not stored, or wiped by a redeploy)", record },
        { status: 410 },
      );
    }
    const inline = /^(image\/|application\/pdf)/.test(record.mimeType);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": record.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(record.filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "download failed" }, { status: 500 });
  }
}
