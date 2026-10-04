/**
 * CSRF defence in depth for cookie-authenticated POSTs (the session cookie is already SameSite=Lax):
 * when the browser sends an Origin header it must be this site. Pure (unit-tested).
 */
type HeaderBag = { get(name: string): string | null };

export function isSameOriginRequest(headers: HeaderBag, appUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL): boolean {
  const origin = headers.get("origin");
  if (!origin) return true; // non-browser client: still needs the session cookie
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const allowed = new Set<string>();
  for (const value of [headers.get("x-forwarded-host"), headers.get("host")]) {
    if (value) allowed.add(value.split(",")[0]!.trim().toLowerCase());
  }
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).host.toLowerCase());
    } catch {
      /* ignore a malformed NEXT_PUBLIC_APP_URL */
    }
  }
  return allowed.has(originHost);
}
