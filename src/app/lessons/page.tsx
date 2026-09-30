import type { Metadata } from "next";
import Link from "next/link";
import { LessonCard } from "@/components/lessons/LessonCard";
import { Icon } from "@/components/ui/Icon";
import { getI18n } from "@/lib/i18n/server";
import { lessonsMessages } from "@/lib/i18n/ns/lessons";
import { featuredWatchCards } from "@/lib/videoLessons";
import "@/styles/lessons.css";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: lessonsMessages[locale].metaTitle };
}

export default async function LessonsIndexPage() {
  const { locale } = await getI18n();
  const t = lessonsMessages[locale];
  const cards = featuredWatchCards();
  return (
    <main className="shell mm-lessons">
      <header className="mm-lessons-head">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="muted">{t.lead}</p>
      </header>

      <Link href="/lessons/interactive" className="mm-card mm-lessons-feature">
        <span className="mm-tile-icon tone-gold" aria-hidden="true">
          <Icon name="spark" size={24} />
        </span>
        <span>
          <strong>{t.featureTitle}</strong>
          <span>{t.featureLead}</span>
        </span>
        <Icon name="arrow" size={20} />
      </Link>

      <section aria-labelledby="mm-lessons-list">
        <h2 id="mm-lessons-list" className="mm-dash-h2">
          {t.featured}
        </h2>
        {cards.length ? (
          <div className="mm-lessons-grid">
            {cards.map((card) => (
              <LessonCard key={card.href} card={card} locale={locale} t={t} />
            ))}
          </div>
        ) : (
          <p className="muted">{t.empty}</p>
        )}
      </section>
    </main>
  );
}
