/**
 * Lesson-video manifest (`content/lessons/<id>/lesson.json`) for the multi-language lesson player.
 *
 * Format (proposed; the designer confirms the final schema):
 * - one SILENT master video per lesson, H.264 MP4 renditions "1080" / "720" / "480" (faststart) + poster.jpg;
 * - one narration track per language (audio.en.m4a / audio.ar.m4a / audio.fr.m4a), each starting at t=0 and exactly
 *   as long as the video, so a single synced <audio> element follows the video clock;
 * - WebVTT subtitles per language, optional chapters.vtt (one cue per storyboard scene);
 * - optional `review_mp4` (EN audio muxed in) for review/sharing — the player only uses it as a last resort;
 * - optional `muxed{lang}` MP4s (audio inside) as a per-language fallback when no silent master exists;
 * - `ai_voice: true` shows a localised "AI voice" label.
 *
 * The parser is deliberately tolerant: unknown keys are ignored, bad/missing renditions or languages are dropped
 * (the UI hides them), and only `id` plus something playable is required. Dependency-free (shared by server, client, tests).
 */

export const LESSON_LANGS = ["en", "ar", "fr"] as const;
export type LessonLang = (typeof LESSON_LANGS)[number];

export const RENDITIONS = ["1080", "720", "480"] as const;
export type Rendition = (typeof RENDITIONS)[number];

export type LangMap<T> = Partial<Record<LessonLang, T>>;

export type ChaptersSource = { all?: string; byLang: LangMap<string> };

export type LessonManifest = {
  id: string;
  title: LangMap<string>;
  level: string;
  curriculum: string;
  /** Seconds (0 when unknown — the player then trusts the media metadata). */
  duration: number;
  aiVoice: boolean;
  poster?: string;
  /** Silent master renditions that were present and valid, keyed by height. */
  video: Partial<Record<Rendition, string>>;
  audio: LangMap<string>;
  subtitles: LangMap<string>;
  chapters?: ChaptersSource;
  /** Muxed (audio-inside) MP4 per language — fallback only. */
  muxed: LangMap<string>;
  /** EN-muxed review/share MP4 — last-resort fallback. */
  reviewMp4?: string;
};

export type ManifestResult = { ok: true; manifest: LessonManifest; warnings: string[] } | { ok: false; error: string };

export const LESSON_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function isLessonLang(value: unknown): value is LessonLang {
  return typeof value === "string" && (LESSON_LANGS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resolve a media reference from the manifest. Relative paths ("audio.en.m4a", "media/x.mp4") are resolved against
 * `mediaBase`; site-absolute ("/lesson-media/…") and http(s) URLs pass through. Anything else (javascript:, data:,
 * protocol-relative, "..", backslashes) is rejected so a manifest cannot point the player somewhere unexpected.
 */
export function resolveMediaUrl(ref: unknown, mediaBase: string): string | null {
  const value = str(ref);
  if (!value || value.length > 2048) return null;
  if (/[\s\\]/.test(value) || value.startsWith("//")) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
      return null;
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  const segments = value.split(/[?#]/)[0].split("/");
  if (segments.some((segment) => segment === "..")) return null;
  if (value.startsWith("/")) return value;
  const base = mediaBase.endsWith("/") ? mediaBase : `${mediaBase}/`;
  return `${base}${value.replace(/^\.\//, "")}`;
}

function langMap(raw: unknown, mediaBase: string | null, field: string, warnings: string[]): LangMap<string> {
  const out: LangMap<string> = {};
  if (raw === undefined || raw === null) return out;
  if (!isRecord(raw)) {
    warnings.push(`${field}: expected an object keyed by language`);
    return out;
  }
  for (const [key, value] of Object.entries(raw)) {
    if (!isLessonLang(key)) {
      warnings.push(`${field}.${key}: unsupported language ignored`);
      continue;
    }
    const resolved = mediaBase === null ? str(value) || null : resolveMediaUrl(value, mediaBase);
    if (resolved) out[key] = resolved;
    else if (value !== undefined && value !== null && value !== "") warnings.push(`${field}.${key}: invalid value ignored`);
  }
  return out;
}

function parseDuration(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  const text = str(raw);
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  // "mm:ss" / "hh:mm:ss(.ms)"
  const parts = text.split(":");
  if (parts.length >= 2 && parts.length <= 3 && parts.every((p) => /^\d+(\.\d+)?$/.test(p))) {
    return parts.reduce((acc, part) => acc * 60 + Number(part), 0);
  }
  return 0;
}

/** Accept "1080" / "1080p" / 1080 as rendition keys. */
function renditionKey(key: string): Rendition | null {
  const match = key.trim().toLowerCase().match(/^(\d{3,4})p?$/);
  if (!match) return null;
  return (RENDITIONS as readonly string[]).includes(match[1]) ? (match[1] as Rendition) : null;
}

export function parseLessonManifest(input: unknown, options: { mediaBase: string; expectedId?: string }): ManifestResult {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return { ok: false, error: "lesson.json is not valid JSON" };
    }
  }
  if (!isRecord(raw)) return { ok: false, error: "lesson.json must be an object" };
  const warnings: string[] = [];
  const base = options.mediaBase;

  const id = str(raw.id) || options.expectedId || "";
  if (!LESSON_ID_RE.test(id)) return { ok: false, error: "id must be lowercase letters, digits and dashes" };
  if (options.expectedId && id !== options.expectedId) warnings.push(`id "${id}" differs from folder "${options.expectedId}"`);

  let title: LangMap<string> = {};
  if (typeof raw.title === "string") title = { en: raw.title.trim() };
  else title = langMap(raw.title, null, "title", warnings);

  const video: Partial<Record<Rendition, string>> = {};
  if (typeof raw.video === "string") {
    const single = resolveMediaUrl(raw.video, base);
    if (single) video["720"] = single;
  } else if (isRecord(raw.video)) {
    for (const [key, value] of Object.entries(raw.video)) {
      const rendition = renditionKey(key);
      const resolved = resolveMediaUrl(value, base);
      if (rendition && resolved) video[rendition] = resolved;
      else warnings.push(`video.${key}: ignored`);
    }
  }

  const audio = langMap(raw.audio, base, "audio", warnings);
  const subtitles = langMap(raw.subtitles, base, "subtitles", warnings);
  const muxed = langMap(raw.muxed, base, "muxed", warnings);

  let chapters: ChaptersSource | undefined;
  if (typeof raw.chapters === "string") {
    const all = resolveMediaUrl(raw.chapters, base);
    if (all) chapters = { all, byLang: {} };
  } else if (isRecord(raw.chapters)) {
    const byLang = langMap(raw.chapters, base, "chapters", warnings);
    if (Object.keys(byLang).length) chapters = { byLang };
  }

  const reviewMp4 = resolveMediaUrl(raw.review_mp4 ?? raw.reviewMp4, base) ?? undefined;
  const poster = resolveMediaUrl(raw.poster, base) ?? undefined;

  const manifest: LessonManifest = {
    id,
    title,
    level: str(raw.level),
    curriculum: str(raw.curriculum),
    duration: parseDuration(raw.duration),
    aiVoice: raw.ai_voice === true || raw.aiVoice === true,
    poster,
    video,
    audio,
    subtitles,
    chapters,
    muxed,
    reviewMp4,
  };

  if (!hasPlayableSource(manifest)) return { ok: false, error: "no playable video (renditions, muxed or review_mp4)" };
  return { ok: true, manifest, warnings };
}

export function hasPlayableSource(manifest: LessonManifest): boolean {
  return Object.keys(manifest.video).length > 0 || Object.keys(manifest.muxed).length > 0 || Boolean(manifest.reviewMp4);
}

export function availableRenditions(manifest: LessonManifest): Rendition[] {
  return RENDITIONS.filter((key) => Boolean(manifest.video[key]));
}

/**
 * How the player will produce sound for a language:
 * - "synced": silent master video + separate narration <audio> (primary design);
 * - "muxed": an MP4 that carries its own audio (per-language fallback, or the EN review MP4 as a last resort);
 * - "silent": video only (no audio for that language — subtitles can still be shown).
 */
export type PlaybackPlan =
  | { mode: "synced"; lang: LessonLang; audio: string }
  | { mode: "muxed"; lang: LessonLang; src: string }
  | { mode: "silent"; lang: LessonLang };

export function playbackPlan(manifest: LessonManifest, lang: LessonLang): PlaybackPlan {
  const hasMaster = Object.keys(manifest.video).length > 0;
  const audio = manifest.audio[lang];
  if (hasMaster && audio) return { mode: "synced", lang, audio };
  const muxed = manifest.muxed[lang];
  if (muxed) return { mode: "muxed", lang, src: muxed };
  if (lang === "en" && manifest.reviewMp4 && !hasMaster) return { mode: "muxed", lang, src: manifest.reviewMp4 };
  if (hasMaster) return { mode: "silent", lang };
  if (manifest.reviewMp4) return { mode: "muxed", lang: "en", src: manifest.reviewMp4 };
  return { mode: "silent", lang };
}

/** Languages offered in the audio switch (anything that can actually be heard), in EN / AR / FR order. */
export function audioLanguages(manifest: LessonManifest): LessonLang[] {
  const hasMaster = Object.keys(manifest.video).length > 0;
  return LESSON_LANGS.filter(
    (lang) =>
      (hasMaster && Boolean(manifest.audio[lang])) ||
      Boolean(manifest.muxed[lang]) ||
      (lang === "en" && !hasMaster && Boolean(manifest.reviewMp4)),
  );
}

export function subtitleLanguages(manifest: LessonManifest): LessonLang[] {
  return LESSON_LANGS.filter((lang) => Boolean(manifest.subtitles[lang]));
}

/**
 * Starting language: the platform UI language when the lesson has it, else English, else the first available one.
 * A lesson with no audio at all still starts on a language that has subtitles (or "en").
 */
export function initialLanguage(manifest: LessonManifest, uiLocale?: string | null): LessonLang {
  const langs = audioLanguages(manifest);
  const pool = langs.length ? langs : subtitleLanguages(manifest);
  if (isLessonLang(uiLocale) && pool.includes(uiLocale)) return uiLocale;
  if (pool.includes("en")) return "en";
  return pool[0] ?? "en";
}

/** Subtitles follow the audio language by default; fall back to EN, then any available track, else none. */
export function subtitleFor(manifest: LessonManifest, lang: LessonLang): LessonLang | null {
  if (manifest.subtitles[lang]) return lang;
  if (manifest.subtitles.en) return "en";
  return subtitleLanguages(manifest)[0] ?? null;
}

export function chaptersUrl(manifest: LessonManifest, lang: LessonLang): string | null {
  if (!manifest.chapters) return null;
  return manifest.chapters.byLang[lang] ?? manifest.chapters.all ?? manifest.chapters.byLang.en ?? Object.values(manifest.chapters.byLang)[0] ?? null;
}

export function lessonTitle(manifest: LessonManifest, lang: string): string {
  return (isLessonLang(lang) ? manifest.title[lang] : undefined) ?? manifest.title.en ?? Object.values(manifest.title)[0] ?? manifest.id;
}
