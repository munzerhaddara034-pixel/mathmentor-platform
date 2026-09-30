import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/lib/i18n/config";
import type { LessonsMessages } from "@/lib/i18n/ns/lessons";

export type LessonCardData = {
  href: string;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  trackAr: string;
  trackEn: string;
  trackFr: string;
  bilingual: boolean;
};

/** Title and track in the UI locale; the other video language is shown as a hint underneath. */
export function LessonCard({ card, locale, t }: { card: LessonCardData; locale: Locale; t: LessonsMessages }) {
  const title = locale === "ar" ? card.titleAr : locale === "fr" ? card.titleFr : card.titleEn;
  const track = locale === "ar" ? card.trackAr : locale === "fr" ? card.trackFr : card.trackEn;
  const sub = locale === "ar" ? `${card.titleEn} · ${card.titleFr}` : locale === "fr" ? card.titleEn : card.titleFr;
  return (
    <Link href={card.href} className="mm-card mm-lesson">
      <span className="mm-lesson-thumb" aria-hidden="true">
        <Icon name="play" size={26} />
      </span>
      <span className="mm-lesson-body">
        <span className="mm-lesson-track">{track}</span>
        <strong>{title}</strong>
        <bdi className="mm-lesson-sub" lang={locale === "fr" ? "en" : "fr"}>
          {sub}
        </bdi>
        <span className="mm-lesson-meta">
          <span className="mm-pill">{card.bilingual ? t.videoBoth : t.videoEn}</span>
          <span className="mm-lesson-go">
            {t.watch} <Icon name="arrow" size={16} />
          </span>
        </span>
      </span>
    </Link>
  );
}
