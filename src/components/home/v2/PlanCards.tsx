import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages/en";
import { REGIONAL_PRICING } from "@/lib/pricing/plans";

/** Plans straight from REGIONAL_PRICING.lebanon (the platform's pricing source); link to every region. */
export function PlanCards({ m, locale }: { m: Messages; locale: Locale }) {
  const t = m.home;
  const plans = REGIONAL_PRICING.lebanon.plans;
  return (
    <section className="v2-section" aria-labelledby="v2-plans-title">
      <div className="v2-sec-title">
        <div>
          <h2 id="v2-plans-title">{t.plansTitle}</h2>
          <p className="v2-sec-lead">{t.plansRegion}</p>
        </div>
        <Link href="/subscribe">{t.plansAll}</Link>
      </div>
      <ul className="v2-plans">
        {plans.map((plan) => {
          const copy = t.plans[plan.id];
          const featured = Boolean(plan.badgeEn);
          const band = plan.usdMonthlyMin === plan.usdMonthlyMax ? `$${plan.usdMonthly}` : `$${plan.usdMonthlyMin}–${plan.usdMonthlyMax}`;
          return (
            <li key={plan.id}>
              <Link href="/subscribe" className={`v2-plan glass${featured ? " is-featured" : ""}`}>
                <span className="v2-plan-copy">
                  {featured ? <span className="v2-chip is-gold">{locale === "ar" ? (plan.badgeAr ?? t.popular) : t.popular}</span> : null}
                  <strong>{copy.name}</strong>
                  <small>{copy.blurb}</small>
                </span>
                <span className="v2-plan-price">
                  <b className="ltr">{band}</b>
                  <small>{m.common.perMonth}</small>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
