"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";
import { getRegionalPricing } from "@/lib/pricing/plans";
import type { RegionSource } from "@/lib/pricing/regionSignals";
import type { GeoRegionState } from "./useGeoRegion";

/** Shown INSTEAD of prices until the student enabled location (no prices in any other state). */
export function LocationGate({ state, onEnable }: { state: GeoRegionState; onEnable: () => void }) {
  const { locale } = useI18n();
  const t = billingMessages[locale].geo;
  const busy = state.status === "locating";
  const problem =
    state.status === "denied"
      ? t.denied
      : state.status === "unavailable"
        ? t.unavailable
        : state.status === "unsupported"
          ? t.unsupported
          : state.status === "failed"
            ? t.failed
            : null;
  const retry = problem !== null && state.status !== "unsupported";
  return (
    <section className="card mm-location-gate" aria-live="polite" data-geo-state={state.status}>
      <p className="eyebrow">{t.title}</p>
      <p>{t.why}</p>
      <p className="muted">{t.privacy}</p>
      {problem ? (
        <p className="studio-teacher-error" role="status">
          {problem}
        </p>
      ) : null}
      {state.status !== "unsupported" ? (
        <button className="btn dark" type="button" disabled={busy} onClick={onEnable} aria-busy={busy}>
          {busy ? t.locating : retry ? t.retry : t.enable}
        </button>
      ) : null}
    </section>
  );
}

/** "Prices for Lebanon · Based on: your location, your network" (+ review note when signals disagree). */
export function RegionNotice({ region, sources, mismatch }: { region: Extract<GeoRegionState, { status: "ready" }>["region"]; sources: RegionSource[]; mismatch: boolean }) {
  const { locale } = useI18n();
  const t = billingMessages[locale].geo;
  const pack = getRegionalPricing(region);
  const label: Record<RegionSource, string> = { location: t.sourceLocation, ip: t.sourceIp, phone: t.sourcePhone };
  return (
    <div className="mm-region-notice" data-region={region}>
      <p className="eyebrow">{fmt(t.showing, { region: locale === "ar" ? pack.labelAr : pack.labelEn })}</p>
      <p className="muted">{fmt(t.basedOn, { sources: sources.map((source) => label[source]).join(locale === "ar" ? "، " : ", ") })}</p>
      {mismatch ? <p className="studio-teacher-error">{t.mismatch}</p> : null}
    </div>
  );
}
