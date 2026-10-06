"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/I18nProvider";
import { fmt } from "@/lib/i18n/format";
import { billingMessages } from "@/lib/i18n/ns/billing";
import { rich } from "@/lib/i18n/rich";
import {
  PLATFORM_FREE_FEATURE,
  getRegionalPricing,
  pricingOptions,
  type PricingOptionId,
  type PricingRegion,
} from "@/lib/pricing/plans";

/**
 * The four ways to buy in one region (pricing v2): digital subscription, subscriber session,
 * platform + 4 sessions bundle, outside-student session. Every number comes from plans.ts.
 */
export function PricingOptions({ region, showBookLink = true }: { region: PricingRegion; showBookLink?: boolean }) {
  const { locale } = useI18n();
  const t = billingMessages[locale].plans;
  const isAr = locale === "ar";
  const pack = getRegionalPricing(region);
  const options = pricingOptions(region);
  const sessionPrice = options.find((option) => option.id === "subscriberSession")?.display ?? "";

  const copy: Record<PricingOptionId, { title: string; note: string }> = {
    subscription: { title: t.optSubscription, note: t.optSubscriptionNote },
    subscriberSession: { title: t.optSubscriberSession, note: t.optSubscriberSessionNote },
    bundle: { title: t.optBundle, note: fmt(t.optBundleNote, { session: sessionPrice }) },
    outsideSession: { title: t.optOutsideSession, note: t.optOutsideSessionNote },
  };

  return (
    <section className="card mm-price-options-card" aria-labelledby={`price-options-${region}`}>
      <p className="eyebrow" id={`price-options-${region}`}>
        {fmt(t.optionsTitle, { region: isAr ? pack.labelAr : pack.labelEn })}
      </p>
      <p className="muted">{t.optionsLead}</p>
      <ul className="mm-price-options">
        {options.map((option) => (
          <li
            key={option.id}
            className={`mm-price-option${option.id === "bundle" ? " is-featured" : ""}`}
            data-option={option.id}
          >
            <strong>{copy[option.id].title}</strong>
            <p className="mm-price-option-amount">
              <span dir="ltr">{option.display}</span>
              <span className="muted">{option.unit === "month" ? t.perMonth : t.perSession}</span>
            </p>
            {option.id === "bundle" ? <span className="badge">{PLATFORM_FREE_FEATURE[locale]}</span> : null}
            <p className="muted">{copy[option.id].note}</p>
            {option.banded ? <p className="muted">{fmt(t.optCharged, { n: option.chargeUsd })}</p> : null}
          </li>
        ))}
      </ul>
      {showBookLink ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {rich(t.privateBook, { link: <Link href="/live">/live</Link> })}
        </p>
      ) : null}
    </section>
  );
}
