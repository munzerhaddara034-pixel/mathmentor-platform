/**
 * LiveKit Cloud env helpers. Secrets stay server-side.
 * Instructor: Prof. Munzer Haddara / الأستاذ منذر حداره.
 */

export type LivekitEnv = {
  url: string;
  apiKey: string;
  apiSecret: string;
  publicUrl: string;
  configured: boolean;
};

export function livekitEnv(): LivekitEnv {
  const url = (process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || "").trim();
  const apiKey = (process.env.LIVEKIT_API_KEY || "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET || "").trim();
  const publicUrl = (process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "").trim();
  return {
    url,
    apiKey,
    apiSecret,
    publicUrl,
    configured: Boolean(url && apiKey && apiSecret),
  };
}

/** Room Service talks HTTPS; client tokens use the wss URL. */
export function livekitHttpUrl(wsOrHttp: string) {
  return wsOrHttp.replace(/^wss:/i, "https:").replace(/^ws:/i, "http:");
}

export const LIVEKIT_TOKEN_TTL = "2h";
