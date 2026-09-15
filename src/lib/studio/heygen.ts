/**
 * HeyGen talking-avatar client.
 *
 * Real HTTP calls run only when `HEYGEN_API_KEY` is set. Local demos and
 * `npm run build` never require a key: the stub returns a Munzer still +
 * silent-timeline job that the Interactive Lesson Player already understands.
 */

const HEYGEN_BASE = "https://api.heygen.com";
const DEMO_POSTER = "/teachers/munzer.jpg";

export type HeyGenLanguage = "ar" | "en";

export type CreateAvatarVideoInput = {
  script: string;
  language: HeyGenLanguage;
  title?: string;
  avatarId?: string;
  voiceId?: string;
  /** Talking-photo still used when no custom avatar id is configured. */
  talkingPhotoUrl?: string;
};

export type HeyGenVideoStatus = "waiting" | "processing" | "completed" | "failed" | "demo";

export type HeyGenVideoJob = {
  videoId: string;
  status: HeyGenVideoStatus;
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  demo: boolean;
  message: string;
  raw?: unknown;
};

export function heygenApiKey() {
  return process.env.HEYGEN_API_KEY?.trim() || "";
}

export function hasHeyGenKey() {
  return heygenApiKey().length > 0;
}

function demoJob(script: string, language: HeyGenLanguage): HeyGenVideoJob {
  return {
    videoId: `demo-munzer-${language}`,
    status: "demo",
    thumbnailUrl: DEMO_POSTER,
    durationSec: Math.max(30, Math.min(240, Math.round(script.length / 12))),
    demo: true,
    message:
      "HEYGEN_API_KEY is not set. Demo mode uses public/teachers/munzer.jpg with HTML5 audio or a silent clock — no HeyGen request was sent.",
  };
}

async function heygenFetch(path: string, init: RequestInit) {
  const key = heygenApiKey();
  const response = await fetch(`${HEYGEN_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Api-Key": key,
      ...(init.headers ?? {}),
    },
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof json === "object" && json && "error" in json
        ? JSON.stringify((json as { error: unknown }).error)
        : response.statusText;
    throw new Error(`HeyGen ${path} failed (${response.status}): ${detail}`);
  }
  return json;
}

function mapStatus(value: unknown): HeyGenVideoStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "completed" || raw === "done") return "completed";
  if (raw === "failed" || raw === "error") return "failed";
  if (raw === "processing" || raw === "pending") return "processing";
  return "waiting";
}

/**
 * Create a talking-avatar (or talking-photo) video from a lesson script.
 * Stubs locally when the API key is missing.
 */
export async function createAvatarTalkingVideo(input: CreateAvatarVideoInput): Promise<HeyGenVideoJob> {
  if (!hasHeyGenKey()) return demoJob(input.script, input.language);

  const avatarId = input.avatarId || process.env.HEYGEN_AVATAR_ID || "";
  const voiceId =
    input.voiceId ||
    (input.language === "ar" ? process.env.HEYGEN_VOICE_ID_AR : process.env.HEYGEN_VOICE_ID_EN) ||
    process.env.HEYGEN_VOICE_ID ||
    "";

  const character = avatarId
    ? { type: "avatar" as const, avatar_id: avatarId, avatar_style: "normal" }
    : {
        type: "talking_photo" as const,
        talking_photo_id: process.env.HEYGEN_TALKING_PHOTO_ID || "munzer-demo",
      };

  const body = {
    caption: false,
    title: input.title ?? "MathMentor lesson",
    video_inputs: [
      {
        character,
        voice: {
          type: "text",
          input_text: input.script.slice(0, 4000),
          voice_id: voiceId || undefined,
        },
      },
    ],
    dimension: { width: 720, height: 1280 },
  };

  const json = (await heygenFetch("/v2/video/generate", {
    method: "POST",
    body: JSON.stringify(body),
  })) as { data?: { video_id?: string }; video_id?: string };

  const videoId = json.data?.video_id ?? json.video_id;
  if (!videoId) {
    throw new Error("HeyGen did not return a video_id.");
  }

  return {
    videoId,
    status: "waiting",
    thumbnailUrl: input.talkingPhotoUrl ?? DEMO_POSTER,
    demo: false,
    message: "HeyGen job created. Poll fetchAvatarTalkingVideo until status is completed.",
    raw: json,
  };
}

/**
 * Fetch a previously created HeyGen video. Demo ids never hit the network.
 */
export async function fetchAvatarTalkingVideo(videoId: string): Promise<HeyGenVideoJob> {
  if (!hasHeyGenKey() || videoId.startsWith("demo-")) {
    return {
      videoId,
      status: "demo",
      thumbnailUrl: DEMO_POSTER,
      demo: true,
      message: "Demo still image — HeyGen was not contacted.",
    };
  }

  const json = (await heygenFetch(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    method: "GET",
  })) as {
    data?: {
      status?: string;
      video_url?: string;
      thumbnail_url?: string;
      duration?: number;
    };
  };

  const data = json.data ?? {};
  return {
    videoId,
    status: mapStatus(data.status),
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url ?? DEMO_POSTER,
    durationSec: data.duration,
    demo: false,
    message: `HeyGen status: ${mapStatus(data.status)}`,
    raw: json,
  };
}
