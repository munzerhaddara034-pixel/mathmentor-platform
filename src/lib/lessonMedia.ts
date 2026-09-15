/** Resolve a lesson video URL for the classroom player. Storyboard is last resort. */

export type VideoKind = "file" | "youtube" | "iframe";

export type ResolvedLessonVideo =
  | { kind: VideoKind; src: string; providerLabel: string }
  | { kind: "storyboard" };

const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

export function youtubeIdFromUrl(url: string): string | null {
  const match = url.match(YOUTUBE_RE);
  return match?.[1] ?? null;
}

export function isDirectMedia(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url) || url.startsWith("/videos/");
}

export function hostedProviderEmbed(url: string): string | null {
  if (/mediadelivery\.net|bunnycdn\.com|b-cdn\.net/i.test(url)) return url;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  if (/player\.vimeo\.com/i.test(url)) return url;
  const wistia = url.match(/(?:wistia\.net\/embed\/iframe\/|wi\.st\/)([A-Za-z0-9]+)/i);
  if (wistia) return `https://fast.wistia.net/embed/iframe/${wistia[1]}`;
  if (/wistia\.net\/embed/i.test(url)) return url;
  return null;
}

function envFallbackEmbed(): string {
  const provider = (process.env.NEXT_PUBLIC_VIDEO_PROVIDER ?? "local").toLowerCase();
  const vimeo = process.env.NEXT_PUBLIC_VIMEO_OTT_URL ?? "";
  const wistia = process.env.NEXT_PUBLIC_WISTIA_ID ?? "";
  const bunny = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID ?? "";
  if (provider === "vimeo-ott" && vimeo) return vimeo;
  if (provider === "wistia" && wistia) return `https://fast.wistia.net/embed/iframe/${wistia}`;
  if (provider === "bunny" && bunny) return `https://iframe.mediadelivery.net/embed/${bunny}`;
  return "";
}

export function resolveLessonVideo(input: { videoUrl?: string | null }): ResolvedLessonVideo {
  const url = input.videoUrl?.trim() ?? "";
  if (url) {
    const youtube = youtubeIdFromUrl(url);
    if (youtube) {
      return {
        kind: "youtube",
        src: `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&modestbranding=1`,
        providerLabel: "YouTube",
      };
    }
    const hosted = hostedProviderEmbed(url);
    if (hosted) {
      return { kind: "iframe", src: hosted, providerLabel: "CDN" };
    }
    if (isDirectMedia(url) || url.startsWith("/")) {
      return { kind: "file", src: url, providerLabel: "ملف محلي" };
    }
    return { kind: "iframe", src: url, providerLabel: "تضمين" };
  }

  const env = envFallbackEmbed();
  if (env) return { kind: "iframe", src: env, providerLabel: "CDN" };
  return { kind: "storyboard" };
}
