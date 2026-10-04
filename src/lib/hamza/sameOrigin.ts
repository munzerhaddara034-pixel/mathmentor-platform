/**
 * CSRF guard for Hamza's state-changing routes (approve / merge / revert / cancel): the browser must send
 * Sec-Fetch-Site: same-origin, or an Origin whose host equals the request host. Pure; unit-tested.
 */
type HeaderBag = { get(name: string): string | null };

export function isSameOriginRequest(headers: HeaderBag): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host.split(",")[0].trim();
  } catch {
    return false;
  }
}
