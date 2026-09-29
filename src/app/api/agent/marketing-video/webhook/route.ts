import { NextResponse } from "next/server";
import { agentWebhookSecretOk } from "@/lib/agent/auth";
import { applyMarketingWebhook, buildSocialPostPayload } from "@/lib/agent/marketing";
import { notifyInstructorHubCompletion } from "@/lib/agent/whatsappSender";

export const runtime = "nodejs";

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {};
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "agent-marketing-webhook" });
}

export async function POST(request: Request) {
  let body: unknown = {};
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("json")) {
      body = await request.json();
    } else {
      const text = await request.text();
      body = text ? JSON.parse(text) : {};
    }
  } catch {
    body = {};
  }

  if (!agentWebhookSecretOk(request, body)) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  try {
    const root = asRecord(body);
    const data = asRecord(root.data ?? root.event_data ?? root.payload);
    const videoId = pickString(data.video_id, root.video_id, data.id);
    const callbackId = pickString(data.callback_id, root.callback_id);
    const videoUrl = pickString(data.video_url, data.url, root.video_url);
    const status = pickString(data.status, root.status, root.event_type);

    const result = await applyMarketingWebhook({
      callbackId,
      videoId,
      videoUrl,
      status,
    });

    let outboundWhatsApp = undefined;
    let whatsappReply = undefined;
    let task = undefined;
    if (result.campaign) {
      const wa = await notifyInstructorHubCompletion({
        intentKind: "generate_video",
        status:
          result.campaign.demo
            ? "demo"
            : result.campaign.videoStatus === "failed"
              ? "failed"
              : "completed",
        transcript: `HeyGen webhook · ${result.campaign.title}`,
        campaign: result.campaign,
        relatedIds: [
          result.campaign.id,
          result.campaign.heygenJobId,
          result.campaign.heygenVideoId,
        ].filter((id): id is string => Boolean(id)),
      });
      outboundWhatsApp = wa.outbound;
      whatsappReply = wa.replyAr;
      task = wa.task;
    }

    return NextResponse.json({
      ok: true,
      notice: result.notice,
      campaign: result.campaign,
      social: result.campaign ? buildSocialPostPayload(result.campaign) : undefined,
      autoPost: false,
      outboundWhatsApp,
      whatsappReply,
      task,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "webhook failed" },
      { status: 500 },
    );
  }
}
