import { NextResponse } from "next/server";
import { createId } from "@/lib/ids";
import { publicProposals } from "@/lib/hamza/publicProposal";
import { handleHumanMessage } from "@/lib/team/agents";
import { requireTeamStaff, teamError } from "@/lib/team/guard";
import { teamRepo } from "@/lib/team/store";
import { isTeamChannelId, type TeamAttachmentRef, type TeamSendResponse, type TeamThreadResponse } from "@/lib/team/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENTS = 4;
const MAX_TEXT = 8000;
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|gif|heic)|application\/pdf|text\/(plain|csv|markdown)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))$/;

export async function GET(request: Request) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  const channel = new URL(request.url).searchParams.get("channel") ?? "team";
  if (!isTeamChannelId(channel)) return teamError(400, "Unknown channel.", "قناة غير معروفة.");
  try {
    const repo = teamRepo();
    const messages = await repo.listMessages(channel, 120);
    const ids = [...new Set(messages.map((message) => message.proposalId).filter((id): id is string => Boolean(id)))];
    const proposals = await repo.listProposals(ids);
    const body: TeamThreadResponse = { ok: true, channel, messages, proposals: publicProposals(proposals), storage: repo.kind };
    return NextResponse.json(body);
  } catch (error) {
    console.error("team/messages GET", error);
    return teamError(500, "Could not load messages.", "تعذّر تحميل الرسائل.");
  }
}

export async function POST(request: Request) {
  const gate = await requireTeamStaff();
  if (!gate.ok) return gate.response;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return teamError(400, "Expected multipart/form-data.", "صيغة الطلب غير صالحة.");
  }
  const channel = form.get("channel");
  const text = String(form.get("text") ?? "").slice(0, MAX_TEXT);
  if (!isTeamChannelId(channel)) return teamError(400, "Unknown channel.", "قناة غير معروفة.");
  const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (!text.trim() && !files.length) return teamError(400, "Empty message.", "اكتب رسالة أو أرفق ملفاً.");
  if (files.length > MAX_ATTACHMENTS) return teamError(400, "Too many files.", `حدّ أقصى ${MAX_ATTACHMENTS} مرفقات.`);

  try {
    const repo = teamRepo();
    const attachments: TeamAttachmentRef[] = [];
    for (const file of files) {
      const mimeType = file.type || "application/octet-stream";
      if (file.size > MAX_ATTACHMENT_BYTES) return teamError(413, "File too large.", `الملف ${file.name} أكبر من 8MB.`);
      if (!ALLOWED_MIME.test(mimeType)) return teamError(415, "Unsupported file type.", `نوع الملف ${file.name} غير مدعوم.`);
      const ref: TeamAttachmentRef = {
        id: createId("tatt"),
        name: file.name.slice(0, 120) || "file",
        mimeType,
        sizeBytes: file.size,
        origin: "upload",
      };
      await repo.saveAttachment(ref, Buffer.from(await file.arrayBuffer()));
      attachments.push(ref);
    }
    const result = await handleHumanMessage({ channel, text, attachments, actor: gate.actor });
    const body: TeamSendResponse = { ok: true, ...result, proposals: publicProposals(result.proposals) };
    return NextResponse.json(body);
  } catch (error) {
    console.error("team/messages POST", error);
    return teamError(500, "Could not send the message.", "تعذّر إرسال الرسالة. حاول مجدداً.");
  }
}
