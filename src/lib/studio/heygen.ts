/**
 * HeyGen talking-avatar client (v2 generate + v1 status).
 *
 * Real HTTP calls run only when `HEYGEN_API_KEY` is set. Local demos and
 * `npm run build` never require a key.
 *
 * Exact generate payload (POST https://api.heygen.com/v2/video/generate):
 * see docs/HEYGEN.md — video_inputs[].character / voice / background,
 * dimension 1280×720, optional callback_id + callback_url.
 */

import { createHash } from "node:crypto";
import { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";

export const HEYGEN_GENERATE_URL = "https://api.heygen.com/v2/video/generate";
export const HEYGEN_STATUS_PATH = "/v1/video_status.get";
const HEYGEN_BASE = "https://api.heygen.com";

export { DEMO_AVATAR_VIDEO, DEMO_POSTER } from "./heygenClient";

export type HeyGenLanguage = "en" | "fr" | "ar";

export type CreateAvatarVideoInput = {
  script: string;
  language: HeyGenLanguage;
  title?: string;
  avatarId?: string;
  voiceId?: string;
  talkingPhotoUrl?: string;
  /** Voice speed 0.5–1.5 (HeyGen OpenAPI). */
  speed?: number;
  callbackId?: string;
  callbackUrl?: string;
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

export type HeyGenGeneratePayload = {
  caption: boolean;
  title: string;
  callback_id?: string;
  callback_url?: string;
  dimension: { width: number; height: number };
  video_inputs: Array<{
    character:
      | { type: "avatar"; avatar_id: string; avatar_style: "normal" }
      | { type: "talking_photo"; talking_photo_id: string };
    voice: {
      type: "text";
      input_text: string;
      voice_id?: string;
      speed: number;
      locale: string;
    };
    background: { type: "color"; value: string };
  }>;
};

export function heygenApiKey() {
  return process.env.HEYGEN_API_KEY?.trim() || "";
}

export function hasHeyGenKey() {
  return heygenApiKey().length > 0;
}

export function clampHeyGenSpeed(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.5, Math.max(0.5, n));
}

export function heygenLocale(language: HeyGenLanguage): string {
  if (language === "fr") return "fr-FR";
  if (language === "ar") return "ar-SA";
  return "en-US";
}

export function resolveHeyGenVoiceId(language: HeyGenLanguage, explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (language === "fr") return process.env.HEYGEN_VOICE_ID_FR?.trim() || process.env.HEYGEN_VOICE_ID?.trim() || "";
  if (language === "ar") return process.env.HEYGEN_VOICE_ID_AR?.trim() || process.env.HEYGEN_VOICE_ID?.trim() || "";
  return process.env.HEYGEN_VOICE_ID_EN?.trim() || process.env.HEYGEN_VOICE_ID?.trim() || "";
}

export function heygenCallbackUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) return undefined;
  return `${base}/api/heygen/webhook`;
}

export function deterministicDemoVideoId(lessonId: string, script: string, language: HeyGenLanguage): string {
  const hash = createHash("sha1")
    .update(`${lessonId}|${language}|${script}`)
    .digest("hex")
    .slice(0, 12);
  return `demo-${hash}`;
}

function demoJob(script: string, language: HeyGenLanguage, videoId?: string): HeyGenVideoJob {
  return {
    videoId: videoId ?? deterministicDemoVideoId("local", script, language),
    status: "demo",
    thumbnailUrl: DEMO_POSTER,
    durationSec: Math.max(30, Math.min(240, Math.round(script.length / 12))),
    demo: true,
    message:
      "HEYGEN_API_KEY is not set. Demo mode uses public/teachers/munzer.jpg with HTML5 audio or a silent clock — no HeyGen request was sent.",
  };
}

export function buildHeyGenGeneratePayload(input: CreateAvatarVideoInput): HeyGenGeneratePayload {
  const avatarId = input.avatarId || process.env.HEYGEN_AVATAR_ID?.trim() || "";
  const voiceId = resolveHeyGenVoiceId(input.language, input.voiceId);
  const speed = clampHeyGenSpeed(input.speed);
  const character = avatarId
    ? { type: "avatar" as const, avatar_id: avatarId, avatar_style: "normal" as const }
    : {
        type: "talking_photo" as const,
        talking_photo_id: process.env.HEYGEN_TALKING_PHOTO_ID?.trim() || "munzer-demo",
      };

  const voice: HeyGenGeneratePayload["video_inputs"][number]["voice"] = {
    type: "text",
    input_text: input.script.slice(0, 4000),
    speed,
    locale: heygenLocale(input.language),
  };
  if (voiceId) voice.voice_id = voiceId;

  const payload: HeyGenGeneratePayload = {
    caption: false,
    title: input.title ?? "MathMentor lesson",
    dimension: { width: 1280, height: 720 },
    video_inputs: [
      {
        character,
        voice,
        background: { type: "color", value: "#10213d" },
      },
    ],
  };
  if (input.callbackId) payload.callback_id = input.callbackId;
  if (input.callbackUrl) payload.callback_url = input.callbackUrl;
  return payload;
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

export function mapHeyGenStatus(value: unknown): HeyGenVideoStatus {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "completed" || raw === "done" || raw === "success") return "completed";
  if (raw === "failed" || raw === "error") return "failed";
  if (raw === "processing" || raw === "pending" || raw === "running") return "processing";
  if (raw === "demo") return "demo";
  return "waiting";
}

/**
 * Create a talking-avatar (or talking-photo) video from a lesson script.
 * Stubs locally when the API key is missing — no network call.
 */
export async function createAvatarTalkingVideo(input: CreateAvatarVideoInput): Promise<HeyGenVideoJob> {
  if (!hasHeyGenKey()) return demoJob(input.script, input.language, input.callbackId);

  const body = buildHeyGenGeneratePayload({
    ...input,
    callbackUrl: input.callbackUrl ?? heygenCallbackUrl(),
  });

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
  if (!videoId || videoId.startsWith("demo-") || !hasHeyGenKey()) {
    return {
      videoId,
      status: "demo",
      thumbnailUrl: DEMO_POSTER,
      videoUrl: DEMO_AVATAR_VIDEO,
      demo: true,
      message: "Demo still / local placeholder — HeyGen was not contacted.",
    };
  }

  const json = (await heygenFetch(`${HEYGEN_STATUS_PATH}?video_id=${encodeURIComponent(videoId)}`, {
    method: "GET",
  })) as {
    data?: {
      status?: string;
      video_url?: string;
      thumbnail_url?: string;
      duration?: number;
      error?: unknown;
    };
  };

  const data = json.data ?? {};
  return {
    videoId,
    status: mapHeyGenStatus(data.status),
    videoUrl: data.video_url,
    thumbnailUrl: data.thumbnail_url ?? DEMO_POSTER,
    durationSec: data.duration,
    demo: false,
    message: `HeyGen status: ${mapHeyGenStatus(data.status)}`,
    raw: json,
  };
}
