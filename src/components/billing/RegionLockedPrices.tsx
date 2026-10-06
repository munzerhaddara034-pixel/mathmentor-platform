"use client";

import { LocationGate, RegionNotice } from "@/components/billing/LocationGate";
import { PricingOptions } from "@/components/billing/PricingOptions";
import { useGeoRegion } from "@/components/billing/useGeoRegion";

/** Region-locked price list: nothing but the location explanation until the server resolved a region. */
export function RegionLockedPrices({ showBookLink = true }: { showBookLink?: boolean }) {
  const geo = useGeoRegion();
  if (geo.state.status !== "ready") return <LocationGate state={geo.state} onEnable={geo.request} />;
  return (
    <>
      <RegionNotice region={geo.state.region} sources={geo.state.sources} mismatch={geo.state.mismatch} />
      <PricingOptions region={geo.state.region} showBookLink={showBookLink} />
    </>
  );
}
