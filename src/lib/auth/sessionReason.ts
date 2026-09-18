export type LiveSessionFailureReason = "unauthenticated" | "replaced" | "expired";

/**
 * Cookie present but no live session: `replaced` only when we recorded a same-class kick.
 * A missing blob / empty store / TTL expiry is `expired`, never a false "another device".
 */
export function liveSessionFailureReason(input: {
  hasCookie: boolean;
  sessionFound: boolean;
  tokenWasReplaced: boolean;
}): LiveSessionFailureReason | null {
  if (input.sessionFound) return null;
  if (!input.hasCookie) return "unauthenticated";
  if (input.tokenWasReplaced) return "replaced";
  return "expired";
}
