import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Ltr } from "@/components/ui/Ltr";

export type LessonCardData = {
  href: string;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  trackAr: string;
  bilingual: boolean;
};

export function LessonCard({ card }: { card: LessonCardData }) {
  return (
    <Link href={card.href} className="mm-card mm-lesson">
      <span className="mm-lesson-thumb" aria-hidden="true">
        <Icon name="play" size={26} />
      </span>
      <span className="mm-lesson-body">
        <span className="mm-lesson-track">{card.trackAr}</span>
        <strong>{card.titleAr}</strong>
        <Ltr className="mm-lesson-sub">
          {card.titleEn} · {card.titleFr}
        </Ltr>
        <span className="mm-lesson-meta">
          <span className="mm-pill">{card.bilingual ? "فيديو بالإنكليزية والفرنسية" : "فيديو بالإنكليزية"}</span>
          <span className="mm-lesson-go">
            شاهد الدرس <Icon name="arrow" size={16} />
          </span>
        </span>
      </span>
    </Link>
  );
}
