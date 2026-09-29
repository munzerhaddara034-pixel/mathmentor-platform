import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { teamRepo } from "@/lib/team/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  try {
    const stored = await teamRepo().getAttachment(id);
    if (!stored) return teamError(404, "Not found.", "المرفق غير موجود.");
    const inline = /^image\/|^application\/pdf$/.test(stored.meta.mimeType);
    return new Response(new Uint8Array(stored.bytes), {
      headers: {
        "Content-Type": stored.meta.mimeType,
        "Content-Length": String(stored.bytes.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(stored.meta.name)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("team/attachments GET", error);
    return teamError(500, "Could not load attachment.", "تعذّر تحميل المرفق.");
  }
}
