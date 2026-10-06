import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { TERMS } from "@/lib/legal/content";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const doc = TERMS[locale];
  return {
    title: `${doc.title} · MathMentor`,
    description: doc.lead,
    alternates: { canonical: "/terms" },
    openGraph: { type: "article", title: doc.title, description: doc.lead, url: "/terms" },
  };
}

/** Terms of use — public and indexable, and the document payment providers ask for. */
export default async function TermsPage() {
  const { locale } = await getI18n();
  return <LegalArticle doc={TERMS[locale]} locale={locale} current="terms" />;
}
