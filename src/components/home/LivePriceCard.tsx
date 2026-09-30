import Link from "next/link";
import { Ltr } from "@/components/ui/Ltr";

function usd(amount: number) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Real prices from the Whish config (dualLiveSessionPrices), not hard-coded marketing numbers. */
export function LivePriceCard({ memberAmount, externalAmount }: { memberAmount: number; externalAmount: number }) {
  return (
    <section className="mm-section">
      <div className="mm-price">
        <div className="mm-price-head">
          <span className="mm-chip on-dark">الحصص المباشرة</span>
          <h2>حصة مع الأستاذ منذر حداره</h2>
        </div>
        <dl>
          <div>
            <dt>مشترك في المنصة</dt>
            <dd>
              <Ltr>{usd(memberAmount)}</Ltr>
            </dd>
          </div>
          <div>
            <dt>من خارج المنصة</dt>
            <dd>
              <Ltr>{usd(externalAmount)}</Ltr>
            </dd>
          </div>
        </dl>
        <Link href="/live" className="btn mm-btn-lg">
          اعرض المواعيد المتاحة
        </Link>
      </div>
    </section>
  );
}
