import { createId } from "@/lib/ids";

export type MeetingProvider = "zoom" | "meet-stub" | "meet-template" | "livekit";

export type MeetingLink = {
  url: string;
  provider: MeetingProvider;
  stub: boolean;
};

function slugFromId(id: string) {
  const compact = id.replace(/[^a-z0-9]/gi, "").toLowerCase().padEnd(10, "m");
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7, 10)}`;
}

function numericId(id: string) {
  let n = 0;
  for (const ch of id) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return String(800_000_000 + (n % 100_000_000));
}

export function meetStubUrl(id: string) {
  return `https://meet.google.com/${slugFromId(id)}`;
}

export function zoomStubUrl(id: string) {
  return `https://zoom.us/j/${numericId(id)}`;
}

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

export async function createMeetingLink(input: {
  id?: string;
  topic: string;
  startsAt: string;
  durationMinutes: number;
}): Promise<MeetingLink> {
  const id = input.id || createId("meet");
  const template = process.env.GOOGLE_MEET_LINK_TEMPLATE?.trim();
  if (template) {
    const code = slugFromId(id);
    return {
      url: template.replace(/\{id\}/g, id).replace(/\{code\}/g, code),
      provider: "meet-template",
      stub: false,
    };
  }

  const zoomAccount = process.env.ZOOM_ACCOUNT_ID?.trim();
  const zoomId = process.env.ZOOM_CLIENT_ID?.trim();
  const zoomSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
  if (zoomAccount && zoomId && zoomSecret) {
    try {
      const url = await createZoomMeeting(input);
      return { url, provider: "zoom", stub: false };
    } catch {
      return { url: zoomStubUrl(id), provider: "zoom", stub: true };
    }
  }
  if (zoomAccount) {
    return { url: zoomStubUrl(id), provider: "zoom", stub: true };
  }

  return { url: meetStubUrl(id), provider: "meet-stub", stub: true };
}
