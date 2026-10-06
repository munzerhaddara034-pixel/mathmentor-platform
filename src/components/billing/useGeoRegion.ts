"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { regionFromCoordinates } from "@/lib/pricing/geoRegion";
import { isPricingRegion, type PricingRegion } from "@/lib/pricing/plans";
import type { RegionSource } from "@/lib/pricing/regionSignals";

export type GeoRegionState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "denied" }
  | { status: "unavailable" }
  | { status: "unsupported" }
  | { status: "failed" }
  | {
      status: "ready";
      /** Server-resolved region: the only one used for prices. */
      region: PricingRegion;
      /** What the browser computed from geolocation: sent back at checkout as ONE signal. */
      locationRegion: PricingRegion;
      sources: RegionSource[];
      mismatch: boolean;
    };

/**
 * Region-locked pricing: ask for geolocation, map the coordinates to a region ON THE DEVICE
 * (geoRegion.ts), forget the coordinates, and let the server resolve the final region from that claim
 * + IP country + phone. Coordinates never leave this function and are never stored.
 */
export function useGeoRegion() {
  const [state, setState] = useState<GeoRegionState>({ status: "idle" });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const resolve = useCallback(async (locationRegion: PricingRegion) => {
    try {
      const response = await fetch("/api/pricing/region", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: locationRegion }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        region?: unknown;
        sources?: RegionSource[];
        mismatch?: boolean;
      };
      if (!alive.current) return;
      if (!response.ok || !body.ok || !isPricingRegion(body.region)) {
        setState({ status: "failed" });
        return;
      }
      setState({
        status: "ready",
        region: body.region,
        locationRegion,
        sources: Array.isArray(body.sources) ? body.sources : ["location"],
        mismatch: body.mismatch === true,
      });
    } catch {
      if (alive.current) setState({ status: "failed" });
    }
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const region = regionFromCoordinates(position.coords.latitude, position.coords.longitude);
        // From here on only the region name exists; the coordinates are not kept or sent anywhere.
        if (!region) {
          if (alive.current) setState({ status: "unavailable" });
          return;
        }
        void resolve(region);
      },
      (error) => {
        if (!alive.current) return;
        setState({ status: error.code === error.PERMISSION_DENIED ? "denied" : "unavailable" });
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60 * 1000 },
    );
  }, [resolve]);

  // Already granted on an earlier visit → no extra click; already blocked → explain how to unblock.
  useEffect(() => {
    const permissions = typeof navigator !== "undefined" ? navigator.permissions : undefined;
    if (!permissions?.query) return;
    permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!alive.current) return;
        if (status.state === "granted") request();
        else if (status.state === "denied") setState({ status: "denied" });
      })
      .catch(() => undefined);
  }, [request]);

  // "locating" covers both the geolocation prompt and the /api/pricing/region fetch: callers render a
  // Skeleton (aria-busy) while loading so prices never flash before the server has decided.
  const loading = state.status === "locating";
  return { state, request, loading };
}
