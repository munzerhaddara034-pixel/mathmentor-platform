import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/LegalArticle";
import { PRIVACY } from "@/lib/legal/content";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const doc = PRIVACY[locale];
  return {
    title: `${doc.title} · MathMentor`,
    description: doc.lead,
    alternates: { canonical: "/privacy" },
    openGraph: { type: "article", title: doc.title, description: doc.lead, url: "/privacy" },
  };
}

/** Privacy policy — public and indexable: payment providers and app stores expect a reachable URL. */
export default async function PrivacyPage() {
  const { locale } = await getI18n();
  return <LegalArticle doc={PRIVACY[locale]} locale={locale} current="privacy" />;
}
