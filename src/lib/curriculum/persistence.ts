import {
  CURRICULUM_COOKIE_KEY,
  CURRICULUM_STORAGE_KEY,
  DEFAULT_CURRICULUM_ID,
  type CurriculumId,
} from "./types";
import { isCurriculumId } from "./catalogs";

export function parseCurriculumId(raw: string | null | undefined): CurriculumId {
  const trimmed = raw?.trim() ?? "";
  return isCurriculumId(trimmed) ? trimmed : DEFAULT_CURRICULUM_ID;
}

/** Client: read localStorage then cookie. */
export function readStoredCurriculumId(): CurriculumId {
  if (typeof window === "undefined") return DEFAULT_CURRICULUM_ID;
  try {
    const fromStorage = window.localStorage.getItem(CURRICULUM_STORAGE_KEY);
    if (isCurriculumId(fromStorage)) return fromStorage;
  } catch {
    /* private mode */
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${CURRICULUM_COOKIE_KEY}=([^;]*)`));
  if (match?.[1]) {
    try {
      return parseCurriculumId(decodeURIComponent(match[1]));
    } catch {
      return DEFAULT_CURRICULUM_ID;
    }
  }
  return DEFAULT_CURRICULUM_ID;
}

/** Client: persist to localStorage + cookie (1 year). */
export function persistCurriculumId(id: CurriculumId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CURRICULUM_STORAGE_KEY, id);
  } catch {
    /* ignore quota */
  }
  const maxAge = 60 * 60 * 24 * 365;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CURRICULUM_COOKIE_KEY}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/** Server: read from Cookie header. */
export function curriculumIdFromCookieHeader(cookieHeader: string | null | undefined): CurriculumId {
  if (!cookieHeader) return DEFAULT_CURRICULUM_ID;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.trim().split("=");
    if (name === CURRICULUM_COOKIE_KEY) {
      try {
        return parseCurriculumId(decodeURIComponent(rest.join("=")));
      } catch {
        return DEFAULT_CURRICULUM_ID;
      }
    }
  }
  return DEFAULT_CURRICULUM_ID;
}
