import { featuredWatchCards } from "@/lib/videoLessons";
import Link from "next/link";

export default function LessonsIndexPage() {
  const cards = featuredWatchCards();
  return (
    <main className="shell" dir="ltr">
      <p className="eyebrow">Watch</p>
      <h1>Classroom videos</h1>
      <p className="muted">
        Default language is English. On bilingual lessons, one EN | FR click switches the voice and every line on the
        board together. Professor Munzer is on camera in each explainer.
      </p>
      <div className="grid two">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="card" style={{ margin: 0 }}>
            {card.bilingual ? <span className="badge approved">EN | FR</span> : <span className="badge">Video</span>}
            <h2>{card.titleEn}</h2>
            <p className="muted">{card.titleFr}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
