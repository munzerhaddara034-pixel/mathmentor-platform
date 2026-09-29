import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAgentRequest } from "@/lib/agent/auth";
import { buildSocialPostPayload, createMarketingCampaign } from "@/lib/agent/marketing";
import { stageMarketingCampaign } from "@/lib/agent/approvalWorkflow";
import { notifyInstructorHubCompletion } from "@/lib/agent/whatsappSender";
import { listCampaigns } from "@/lib/agent/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  audience: z.string().optional(),
  language: z.enum(["ar", "en", "fr"]).optional(),
  autoPostApproved: z.boolean().optional(),
  title: z.string().optional(),
});

export async function GET() {
  try {
    const campaigns = await listCampaigns(12);
    return NextResponse.json({ ok: true, campaigns });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "list failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorizeAgentRequest(request);
  if (!auth.ok) return auth.error;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }

  const parsed = bodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid body.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { campaign, notice } = await createMarketingCampaign({
      ...parsed.data,
      autoPostApproved: false, // never auto-post without approve workflow
    });
    const staged = await stageMarketingCampaign(campaign);
    const wa = await notifyInstructorHubCompletion({
      intentKind: "generate_video",
      status: "queued",
      transcript: `Agent Hub · مسودّة حملة بانتظار الموافقة: ${campaign.title}`,
      campaign,
      relatedIds: [campaign.id, staged.item.id, campaign.heygenJobId, campaign.heygenVideoId].filter(
        (id): id is string => Boolean(id),
      ),
    });
    return NextResponse.json({
      ok: true,
      auth: auth.mode,
      campaign,
      notice: `${notice} · staged ${staged.item.id} AWAITING_APPROVAL`,
      stagedApproval: staged.item,
      social: buildSocialPostPayload(campaign),
      brand: "Prof. Munzer Haddara / الأستاذ منذر حداره",
      outboundWhatsApp: wa.outbound,
      whatsappReply: wa.replyAr,
      task: wa.task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "marketing-video failed",
      },
      { status: 500 },
    );
  }
}
