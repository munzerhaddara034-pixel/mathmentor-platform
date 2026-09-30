/**
 * Meta Graph API root (host + version) shared by text and media senders. Dependency-free.
 * WHATSAPP_GRAPH_VERSION pins the version (default v21.0); WHATSAPP_GRAPH_BASE_URL may point at
 * an https proxy or a localhost mock (tests only).
 */
export function graphApiVersion(): string {
  const pinned = process.env.WHATSAPP_GRAPH_VERSION?.trim();
  return pinned && /^v\d+\.\d+$/.test(pinned) ? pinned : "v21.0";
}

function graphHost(): string {
  const override = process.env.WHATSAPP_GRAPH_BASE_URL?.trim().replace(/\/+$/, "");
  if (override && /^(https:\/\/[^\s/]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)$/.test(override)) return override;
  return "https://graph.facebook.com";
}

/** `https://graph.facebook.com/v21.0/<path>` */
export function graphUrl(path: string): string {
  return `${graphHost()}/${graphApiVersion()}/${path.replace(/^\/+/, "")}`;
}
