import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";

type Tile = { href: string; title: string; body: string; cta: string; icon: IconName; tone: "navy" | "gold" | "teal" | "coral" };

const TILES: Tile[] = [
  { href: "/lessons", title: "الدروس", body: "فيديو مع سبورة تتحرّك مع الشرح: تعريف، قانون، مثالان، خطأ شائع، وتمارين.", cta: "ابدأ درساً", icon: "book", tone: "navy" },
  { href: "/math-solver", title: "حلّال المسائل", body: "صوّر المسألة أو اكتبها، واحصل على حل مرتّب بخطوات الامتحان الرسمي.", cta: "جرّب الحلّال", icon: "camera", tone: "gold" },
  { href: "/live", title: "حصة مباشرة", body: "حصة فردية مع الأستاذ منذر في الموعد الذي يناسبك.", cta: "اعرض المواعيد", icon: "video", tone: "teal" },
  { href: "/exams", title: "محاكاة الامتحان", body: "نماذج بأسلوب الامتحان الرسمي مع توقيت وتوزيع العلامات.", cta: "ابدأ المحاكاة", icon: "exam", tone: "coral" },
];

export function FeatureTiles() {
  return (
    <section className="mm-section" aria-labelledby="mm-features-title">
      <h2 id="mm-features-title" className="mm-section-title">
        كل ما تحتاجه في مكان واحد
      </h2>
      <div className="mm-tiles">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="mm-card mm-tile">
            <span className={`mm-tile-icon tone-${tile.tone}`}>
              <Icon name={tile.icon} size={26} />
            </span>
            <h3>{tile.title}</h3>
            <p>{tile.body}</p>
            <span className="mm-tile-go">
              {tile.cta} <Icon name="arrow" size={18} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
