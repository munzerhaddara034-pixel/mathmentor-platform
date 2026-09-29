import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook (owner route).
 * Credentials come only from the environment — never hardcode tokens or phone-number IDs here.
 *   WHATSAPP_ACCESS_TOKEN     Meta permanent / system-user token (alias: WHATSAPP_TOKEN)
 *   WHATSAPP_PHONE_NUMBER_ID  Sender phone-number ID from Meta → WhatsApp → API setup
 *   WHATSAPP_VERIFY_TOKEN     Value typed into Meta's webhook "Verify token" field
 */
const GRAPH_API_VERSION = "v21.0";
const DEFAULT_VERIFY_TOKEN = "mathmentor_verify_token_2026";

type WhatsAppConfig = { accessToken: string; phoneNumberId: string };

type InboundTextMessage = {
  from?: string;
  type?: string;
  text?: { body?: string };
};

type MetaWebhookBody = {
  entry?: Array<{
    changes?: Array<{
      value?: { messages?: InboundTextMessage[] };
    }>;
  }>;
};

function verifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || DEFAULT_VERIFY_TOKEN;
}

function whatsappConfig(): WhatsAppConfig | null {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken()) {
    return new NextResponse(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as MetaWebhookBody;
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const fromNumber = message?.from;
    const incomingText = message?.text?.body;

    if (!fromNumber || !incomingText) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    const config = whatsappConfig();
    if (!config) {
      // Acknowledge so Meta does not retry forever; the reply is skipped until the env is configured.
      console.warn(
        "WhatsApp webhook: WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set — inbound message acknowledged, no reply sent.",
      );
      return NextResponse.json({ status: "not_configured" }, { status: 200 });
    }

    console.log(`WhatsApp inbound from ${fromNumber} (${incomingText.length} chars)`);

    const replyText = `تم استلام رسالتك: "${incomingText}". أهلاً بك في منصة Math Mentor! كيف يمكننا مساعدتك اليوم؟`;

    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: fromNumber,
        type: "text",
        text: {
          preview_url: false,
          body: replyText,
        },
      }),
    });

    const resData: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("Meta API error:", response.status, JSON.stringify(resData));
      return NextResponse.json({ status: "send_failed", httpStatus: response.status }, { status: 200 });
    }

    return NextResponse.json({ status: "success", data: resData }, { status: 200 });
  } catch (error) {
    console.error("Error handling WhatsApp message:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
