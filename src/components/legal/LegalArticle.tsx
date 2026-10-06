import Link from "next/link";
import { LEGAL_CONTACT, LEGAL_TITLES, type LegalDoc, type LegalDocId } from "@/lib/legal/content";
import type { Locale } from "@/lib/i18n/config";
import "@/styles/legal.css";

const LABELS: Record<Locale, { updated: string; contact: string; whatsapp: string; email: string; seeAlso: string }> = {
  ar: { updated: "آخر تحديث", contact: "التواصل", whatsapp: "واتساب", email: "البريد الإلكتروني", seeAlso: "اقرأ أيضاً" },
  en: { updated: "Last updated", contact: "Contact", whatsapp: "WhatsApp", email: "E-mail", seeAlso: "See also" },
  fr: { updated: "Dernière mise à jour", contact: "Contact", whatsapp: "WhatsApp", email: "E-mail", seeAlso: "Voir aussi" },
};

/** Server-rendered legal document: headings, lists, contact channels and a link to the other page. */
export function LegalArticle({ doc, locale, current }: { doc: LegalDoc; locale: Locale; current: LegalDocId }) {
  const labels = LABELS[locale];
  const otherId: LegalDocId = current === "privacy" ? "terms" : "privacy";
  const whatsappHref = `https://wa.me/${LEGAL_CONTACT.whatsapp}`;
  return (
    <main className="shell mm-legal">
      <article className="mm-legal-doc">
        <header>
          <h1>{doc.title}</h1>
          <p className="v2-muted v2-small">
            {labels.updated}: {doc.updated} · {LEGAL_CONTACT.entity[locale]} · {LEGAL_CONTACT.place[locale]}
          </p>
          <p>{doc.lead}</p>
        </header>
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2>{section.heading}</h2>
            {section.body?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet.slice(0, 40)}>{bullet}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <section id="contact-channels">
          <h2>{labels.contact}</h2>
          <ul>
            <li>
              {labels.whatsapp}: <a href={whatsappHref} dir="ltr" rel="noopener noreferrer" target="_blank">{LEGAL_CONTACT.whatsappDisplay}</a>
            </li>
            <li>
              {labels.email}: <a href={`mailto:${LEGAL_CONTACT.email}`} dir="ltr">{LEGAL_CONTACT.email}</a>
            </li>
            <li dir="ltr">{LEGAL_CONTACT.phoneDisplay}</li>
          </ul>
        </section>
        <nav className="mm-legal-nav" aria-label={labels.seeAlso}>
          <Link className="v2-chip v2-chip-btn" href={`/${otherId}`}>
            {LEGAL_TITLES[otherId][locale]}
          </Link>
          <Link className="v2-chip v2-chip-btn" href="/subscribe">
            {locale === "ar" ? "الاشتراكات" : locale === "fr" ? "Formules" : "Plans"}
          </Link>
        </nav>
      </article>
    </main>
  );
}
