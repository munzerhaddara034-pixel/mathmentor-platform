import { NextRequest, NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/security/webhookSignature";
import { warnOnce } from "@/lib/security/webhookProvenance";
import { isAuthorizedInstructorPhone, normalizeWhatsAppDigits } from "@/lib/whatsapp/adapter";
import { POST as agentWebhookPost } from "@/app/api/agent/whatsapp-voice/route";
import { decideMetaVerification, logVerificationFailure } from "@/lib/whatsapp/verifyToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Meta WhatsApp Cloud API webhook (owner route).
 * Credentials come only from the environment — never hardcode tokens or phone-number IDs here.
 *   WHATSAPP_ACCESS_TOKEN     Meta permanent / system-user token (alias: WHATSAPP_TOKEN)
 *   WHATSAPP_PHONE_NUMBER_ID  Sender phone-number ID from Meta → WhatsApp → API setup
 *   WHATSAPP_VERIFY_TOKEN     Value typed into Meta's webhook "Verify token" field (required —
 *                             no built-in fallback; unset ⇒ verification fails closed with a log line)
 */
const GRAPH_API_VERSION = "v21.0";

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

function whatsappConfig(): WhatsAppConfig | null {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const decision = decideMetaVerification(searchParams);
  if (decision.ok) {
    return new NextResponse(decision.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  logVerificationFailure("/api/whatsapp", decision.reason);
  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    // Unsigned POSTs could make us message any number with attacker text; verify Meta's signature
    // whenever WHATSAPP_APP_SECRET is configured.
    const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() || "";
    if (appSecret && !verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
      return NextResponse.json({ status: "invalid_signature" }, { status: 401 });
    }
    if (!appSecret) warnOnce("WHATSAPP_APP_SECRET is not set — Meta webhook signatures are not verified (/api/whatsapp).");
    let body: MetaWebhookBody = {};
    try {
      body = JSON.parse(rawBody || "{}") as MetaWebhookBody;
    } catch {
      body = {};
    }
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const fromNumber = message?.from;
    const incomingText = message?.text?.body;

    // If Meta's callback URL points here, the instructor's text / voice notes / photos still reach
    // محمد: hand the untouched raw body (and its signature header) to the agent webhook, which
    // re-verifies the signature and answers in the background.
    if (fromNumber && isAuthorizedInstructorPhone(normalizeWhatsAppDigits(fromNumber))) {
      const headers = new Headers({ "content-type": "application/json" });
      const signature = request.headers.get("x-hub-signature-256");
      if (signature) headers.set("x-hub-signature-256", signature);
      const forwardUrl = new URL("/api/agent/whatsapp-voice", request.url).toString();
      return agentWebhookPost(new Request(forwardUrl, { method: "POST", headers, body: rawBody }));
    }

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
