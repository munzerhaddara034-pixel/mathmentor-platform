/** Video delivery config. Real DRM needs a paid OTT CDN; local player uses watermark only. */
export const videoSecurity = {
  provider: (process.env.NEXT_PUBLIC_VIDEO_PROVIDER ?? "local") as "local" | "bunny" | "vimeo-ott" | "wistia",
  bunnyLibraryId: process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID ?? "",
  vimeoOttUrl: process.env.NEXT_PUBLIC_VIMEO_OTT_URL ?? "",
  wistiaHashedId: process.env.NEXT_PUBLIC_WISTIA_ID ?? "",
  disableDownloadHint: true,
  dynamicWatermark: true,
};

export function watermarkText(studentName = "طالب المنصة", phone = "76532421") {
  return `${studentName} · ${phone}`;
}

export function hostedEmbedSrc() {
  if (videoSecurity.provider === "vimeo-ott" && videoSecurity.vimeoOttUrl) return videoSecurity.vimeoOttUrl;
  if (videoSecurity.provider === "wistia" && videoSecurity.wistiaHashedId) {
    return `https://fast.wistia.net/embed/iframe/${videoSecurity.wistiaHashedId}`;
  }
  if (videoSecurity.provider === "bunny" && videoSecurity.bunnyLibraryId) {
    return `https://iframe.mediadelivery.net/embed/${videoSecurity.bunnyLibraryId}`;
  }
  return "";
}
