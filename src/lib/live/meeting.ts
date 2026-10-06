import { createId } from "@/lib/ids";

export type MeetingProvider = "zoom" | "meet-stub" | "meet-template" | "livekit";

export type MeetingLink = {
  url: string;
  provider: Exclude<MeetingProvider, "meet-stub">;
};

function slugFromId(id: string) {
  const compact = id.replace(/[^a-z0-9]/gi, "").toLowerCase().padEnd(10, "m");
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7, 10)}`;
}

/** Hard deadline for both Zoom calls: the booking flow falls back to an in-app room on failure. */
const ZOOM_TIMEOUT_MS = 15_000;

async function createZoomMeeting(input: {
  topic: string;
  startsAt: string;
  durationMinutes: number;
}): Promise<string> {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim();
  const clientId = process.env.ZOOM_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
  if (!accountId || !clientId || !clientSecret) {
    throw new Error("Zoom Server-to-Server OAuth env incomplete.");
  }
  const tokenRes = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
    },
  );
  if (!tokenRes.ok) {
    throw new Error(`Zoom token ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("Zoom token missing.");
  const meetRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    signal: AbortSignal.timeout(ZOOM_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic: input.topic,
      type: 2,
      start_time: input.startsAt,
      duration: input.durationMinutes,
      timezone: "Asia/Beirut",
      settings: { join_before_host: true, waiting_room: false },
    }),
  });
  if (!meetRes.ok) throw new Error(`Zoom meeting ${meetRes.status}`);
  const meetJson = (await meetRes.json()) as { join_url?: string };
  if (!meetJson.join_url) throw new Error("Zoom join_url missing.");
  return meetJson.join_url;
}

/**
 * External meeting link (Google Meet template or a real Zoom meeting) — or `null`.
 * Never invents a Meet/Zoom URL: without a provider the booking uses the in-app classroom.
 */
export async function createMeetingLink(input: {
  id?: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
}): Promise<MeetingLink | null> {
  const id = input.id || createId("meet");
  const template = process.env.GOOGLE_MEET_LINK_TEMPLATE?.trim();
  if (template) {
    const code = slugFromId(id);
    return {
      url: template.replace(/\{id\}/g, id).replace(/\{code\}/g, code),
      provider: "meet-template",
    };
  }

  const zoomAccount = process.env.ZOOM_ACCOUNT_ID?.trim();
  const zoomId = process.env.ZOOM_CLIENT_ID?.trim();
  const zoomSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
  if (zoomAccount && zoomId && zoomSecret) {
    try {
      const url = await createZoomMeeting(input);
      return { url, provider: "zoom" };
    } catch (error) {
      console.warn("[mathmentor] Zoom meeting creation failed", error instanceof Error ? error.message : error);
      return null;
    }
  }
  return null;
}
