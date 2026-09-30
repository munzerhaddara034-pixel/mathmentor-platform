import { NextResponse } from "next/server";
import { setProfileLocale } from "@/lib/auth/db";
import { getSession } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n/config";
import { localeCookie } from "@/lib/i18n/cookie";

export const runtime = "nodejs";

type LocaleResponse = { ok: true; locale: string; savedToProfile: boolean } | { ok: false; error: string };

/**
 * PUT { locale: "en" | "ar" | "fr" } — sets the server-readable `mm-locale` cookie for everyone and, for a
 * signed-in account that has a profile row, saves it on the profile too (applied again at login).
 */
export async function PUT(request: Request) {
  let body: { locale?: unknown };
  try {
    body = (await request.json()) as { locale?: unknown };
  } catch {
    return NextResponse.json<LocaleResponse>({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  if (!isLocale(body.locale)) {
    return NextResponse.json<LocaleResponse>({ ok: false, error: "Unsupported locale." }, { status: 400 });
  }
  const locale = body.locale;
  let savedToProfile = false;
  try {
    const user = await getSession();
    if (user) savedToProfile = await setProfileLocale(user.email, locale);
  } catch (error) {
    // Profile DB unavailable: the cookie still applies on this device.
    console.warn("locale: profile save failed", error);
  }
  const response = NextResponse.json<LocaleResponse>({ ok: true, locale, savedToProfile });
  response.cookies.set(localeCookie(locale));
  return response;
}
