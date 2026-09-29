import { PRICING_STUDY } from "@/lib/b2b/pricingStudy";

/** Bilingual pricing study table — numbers from `pricingStudy.ts` only. */
export function PricingStudyTable() {
  return (
    <section className="card b2b-section mm-mobile-stack no-print" aria-labelledby="b2b-pricing-title">
      <h2 id="b2b-pricing-title">دراسة التسعير / Pricing study</h2>
      <p className="muted" dir="rtl" lang="ar">
        الأرقام الرسمية لشراكات المدارس والباقات — مصدر واحد:{" "}
        <code>src/lib/b2b/pricingStudy.ts</code>
      </p>
      <div className="b2b-table-wrap">
        <table className="b2b-pricing-table">
          <thead>
            <tr>
              <th scope="col">الباقة / Plan</th>
              <th scope="col">الجمهور / Audience</th>
              <th scope="col">السعر / Price</th>
              <th scope="col">يشمل / Includes</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_STUDY.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong dir="rtl" lang="ar">
                    {row.nameAr}
                  </strong>
                  <br />
                  <span dir="ltr">{row.nameEn}</span>
                </td>
                <td>
                  <span dir="rtl" lang="ar">
                    {row.audienceAr}
                  </span>
                  <br />
                  <span className="muted" dir="ltr">
                    {row.audienceEn}
                  </span>
                </td>
                <td>
                  <strong dir="ltr">{row.priceEn}</strong>
                  <br />
                  <span dir="rtl" lang="ar">
                    {row.priceAr}
                  </span>
                </td>
                <td>
                  <ul className="b2b-includes" dir="rtl" lang="ar">
                    {row.includesAr.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <ul className="b2b-includes muted" dir="ltr">
                    {row.includesEn.map((item) => (
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
