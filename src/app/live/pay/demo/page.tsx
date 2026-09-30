import Link from "next/link";
import { liveMessages } from "@/lib/i18n/ns/live";
import { rich } from "@/lib/i18n/rich";
import { getI18n } from "@/lib/i18n/server";

export default async function LivePayDemoRedirectPage() {
  const { locale } = await getI18n();
  const t = liveMessages[locale].pay;
  return (
    <main className="shell mm-mobile-stack">
      <p className="eyebrow">Whish · MathMentor</p>
      <h1>{t.demoTitle}</h1>
      <p className="muted">{rich(t.demoLead, { link: <Link href="/live">/live</Link> })}</p>
      <p>
        <Link className="btn dark" href="/live">
          {t.backToLive}
        </Link>
      </p>
    </main>
  );
}
