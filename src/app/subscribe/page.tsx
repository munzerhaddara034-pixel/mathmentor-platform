import { readStore } from "@/lib/store";
import { SubscribePlans } from "@/components/billing/SubscribePlans";
import { whishTransferPhone, whishTransferNameAr } from "@/lib/whish/client";
import { billingMessages } from "@/lib/i18n/ns/billing";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function SubscribePage() {
  const store = await readStore();
  const settings = store.settings;
  const phone = whishTransferPhone();
  const nameAr = whishTransferNameAr();
  const { locale } = await getI18n();
  const t = billingMessages[locale].page;

  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">{t.eyebrow}</p>
      <h1>{t.title}</h1>
      <p className="muted">
        {rich(t.lead, {
          phone: <strong dir="ltr">{phone}</strong>,
          name: <strong>{locale === "ar" ? nameAr : "Munzer Ahmad Haddara"}</strong>,
          support: <span dir="ltr">{settings.phone}</span>,
        })}
      </p>
      <SubscribePlans contactPhone={settings.phone} contactNote={settings.contactNote} />
    </main>
  );
}
