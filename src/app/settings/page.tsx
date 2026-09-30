import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSettings } from "@/components/settings/LanguageSettings";
import { getProfileLocale } from "@/lib/auth/db";
import { getSession } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import "@/styles/settings.css";

export const dynamic = "force-dynamic";

/** Account settings for every role (student, parent, teacher/admin): language + appearance. */
export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect("/login?next=/settings");
  const { m, locale } = await getI18n();
  let profileLocale: Awaited<ReturnType<typeof getProfileLocale>> = null;
  try {
    profileLocale = await getProfileLocale(user.email);
  } catch {
    profileLocale = null;
  }
  const t = m.settings;
  return (
    <main className="shell v2-settings">
      <header className="v2-settings-head">
        <h1>{t.title}</h1>
        <p className="v2-muted">{t.lead}</p>
      </header>
      <section className="mm-card v2-settings-card" aria-labelledby="v2-settings-lang">
        <h2 id="v2-settings-lang">{t.languageTitle}</h2>
        <p className="v2-muted v2-small">{t.languageLead}</p>
        <LanguageSettings current={locale} profileLocale={profileLocale} />
      </section>
      <section className="mm-card v2-settings-card" aria-labelledby="v2-settings-theme">
        <h2 id="v2-settings-theme">{t.themeTitle}</h2>
        <p className="v2-muted v2-small">{t.themeLead}</p>
        <ThemeToggle />
      </section>
      <p>
        <Link href="/profile" className="mm-link">
          {t.profileLink}
        </Link>
      </p>
    </main>
  );
}
