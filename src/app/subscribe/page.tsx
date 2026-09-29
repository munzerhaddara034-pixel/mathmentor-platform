import { readStore } from "@/lib/store";
import { SubscribePlans } from "@/components/billing/SubscribePlans";
import { whishTransferPhone, whishTransferNameAr } from "@/lib/whish/client";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const store = await readStore();
  const settings = store.settings;
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();

  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">Subscription · Multi-region pricing</p>
      <h1>رسوم الاشتراك · Whish / Western Union / OMT</h1>
      <p className="muted" dir="rtl">
        أسعار حسب المنطقة (لبنان / الخليج / دولي) مرتبطة بالمنهج. التحويل اليدوي عبر Whish إلى{" "}
        <strong>{phone}</strong> باسم <strong>{nameAr}</strong>، أو Western Union / OMT للمستفيد نفسه. واتساب للدعم فقط
        وليس للدفع. بعد تأكيد الأستاذ منذر حداره يُفعَّل الاشتراك.
      </p>
      <p className="muted">
        Regional prices (Lebanon / GCC / International) follow the curriculum switcher. Pay by manual transfer via Whish
        to <strong>{phone}</strong> ({nameAr} / Munzer Ahmad Haddara), or Western Union / OMT to the same beneficiary.
        Academy WhatsApp ({settings.phone}) is support-only. Redeem cards on /redeem remain optional after confirmation.
      </p>
      <SubscribePlans contactPhone={settings.phone} contactNote={settings.contactNote} />
    </main>
  );
}
