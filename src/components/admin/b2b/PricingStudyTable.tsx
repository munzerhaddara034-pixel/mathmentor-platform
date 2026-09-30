import { PRICING_STUDY } from "@/lib/b2b/pricingStudy";
import type { Locale } from "@/lib/i18n/config";
import { b2bMessages } from "@/lib/i18n/ns/b2b";

/**
 * Pricing study table — numbers from `pricingStudy.ts` only. Plan data is authored in ar + en;
 * ar shows the Arabic columns, en/fr show the English ones.
 */
export function PricingStudyTable({ locale }: { locale: Locale }) {
  const t = b2bMessages[locale].pricing;
  const isAr = locale === "ar";
  return (
    <section className="card b2b-section mm-mobile-stack no-print" aria-labelledby="b2b-pricing-title">
      <h2 id="b2b-pricing-title">{t.title}</h2>
      <p className="muted">
        {t.lead} <code dir="ltr">src/lib/b2b/pricingStudy.ts</code>
      </p>
      <div className="b2b-table-wrap">
        <table className="b2b-pricing-table">
          <thead>
            <tr>
              <th scope="col">{t.plan}</th>
              <th scope="col">{t.audience}</th>
              <th scope="col">{t.price}</th>
              <th scope="col">{t.includes}</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_STUDY.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{isAr ? row.nameAr : row.nameEn}</strong>
                </td>
                <td>{isAr ? row.audienceAr : row.audienceEn}</td>
                <td>
                  <strong>{isAr ? row.priceAr : row.priceEn}</strong>
                </td>
                <td>
                  <ul className="b2b-includes">
                    {(isAr ? row.includesAr : row.includesEn).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
