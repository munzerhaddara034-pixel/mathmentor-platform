/**
 * Which media URLs may receive provider credentials. Matching is on the parsed https host
 * (never a substring of the whole URL: "https://evil.example/whatsapp.ogg" must not get the
 * Meta bearer token). Dependency-free.
 */
const META_HOSTS = [/^graph\.facebook\.com$/, /(^|\.)fbsbx\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)whatsapp\.net$/];
const TWILIO_HOSTS = [/(^|\.)twilio\.com$/];

function httpsHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isMetaMediaHost(url: string): boolean {
  const host = httpsHost(url);
  return Boolean(host && META_HOSTS.some((re) => re.test(host)));
}

export function isTwilioMediaHost(url: string): boolean {
  const host = httpsHost(url);
  return Boolean(host && TWILIO_HOSTS.some((re) => re.test(host)));
}

/** Auth headers for a provider media URL; empty for any other host. */
export function providerMediaAuthHeaders(
  url: string,
  creds: { metaToken?: string; twilioSid?: string; twilioToken?: string },
): Record<string, string> {
  if (creds.metaToken && isMetaMediaHost(url)) return { Authorization: `Bearer ${creds.metaToken}` };
  if (creds.twilioSid && creds.twilioToken && isTwilioMediaHost(url)) {
    return { Authorization: `Basic ${Buffer.from(`${creds.twilioSid}:${creds.twilioToken}`).toString("base64")}` };
  }
  return {};
}
