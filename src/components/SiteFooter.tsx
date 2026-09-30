import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export async function SiteFooter() {
  const { m } = await getI18n();
  return (
    <footer className="site-footer">
      <span>
        <strong>{m.brand.name}</strong> · <bdi dir="ltr">{m.brand.sub}</bdi> · {m.footer.tagline}
      </span>
      <nav aria-label={m.footer.links}>
        <Link href="/subscribe">{m.nav.subscribe}</Link>
        <Link href="/live">{m.nav.live}</Link>
        <Link href="/lessons">{m.nav.lessons}</Link>
      </nav>
    </footer>
  );
}
