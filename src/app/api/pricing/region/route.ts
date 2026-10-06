/**
 * POST { location: "lebanon" | "gcc" | "international" | "admissions_us" } → the region whose prices this visitor may see.
 * `location` is the region the BROWSER computed from geolocation (geoRegion.ts); coordinates are never
 * sent here. The server cross-checks it with the trusted IP country and the phone on file and returns
 * only the resolved region, the names of the sources it used and the mismatch flag. Nothing is stored
 * or logged. Public (prices are public); a signed-in user's phone adds a signal.
 */
import { NextResponse } from "next/server";
import { getLiveSession } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/payments/validation";
import { regionSourceList, resolveRegionForRequest } from "@/lib/pricing/regionSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function POST(request: Request) {
  let location: unknown = null;
  try {
    const raw = await request.text();
    if (raw.length > 512) return NextResponse.json({ ok: false, error: "Body too large." }, { status: 413, headers: NO_STORE });
    const body = raw ? (JSON.parse(raw) as { location?: unknown }) : {};
    location = body && typeof body === "object" ? body.location : null; // any other field (e.g. coords) is ignored
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400, headers: NO_STORE });
  }

  let phone: string | null = null;
  try {
    const live = await getLiveSession();
    if (live.ok) phone = normalizePhone(live.user.contactPhone);
  } catch {
    /* anonymous visitor */
  }

  const resolution = resolveRegionForRequest({ location, headers: request.headers, phone });
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, reason: resolution.reason }, { status: 200, headers: NO_STORE });
  }
  return NextResponse.json(
    {
      ok: true,
      region: resolution.region,
      sources: regionSourceList(resolution.sources),
      mismatch: resolution.mismatch,
    },
    { headers: NO_STORE },
  );
}
