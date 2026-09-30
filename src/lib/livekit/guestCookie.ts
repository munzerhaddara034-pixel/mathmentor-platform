/** Edge-safe (no node:crypto) helpers for the mm_live_guest cookie used by middleware. */

/**
 * Cheap shape check for the guest cookie (`<base64url payload>.<base64url hmac>`), so arbitrary
 * junk cookies do not skip the login redirect. The HMAC, expiry, booking and room are still
 * verified server-side by the classroom page and every classroom API.
 */
export function looksLikeGuestToken(value: string | undefined): boolean {
  if (!value || value.length > 1024) return false;
  return /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{20,}$/.test(value);
}
