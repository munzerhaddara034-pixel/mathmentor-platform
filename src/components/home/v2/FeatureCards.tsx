import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Messages } from "@/lib/i18n/messages/en";

const FEATURES: { key: keyof Messages["home"]["features"]; href: string; icon: IconName; tone: "c" | "v" | "g" | "m" }[] = [
  { key: "solver", href: "/math-solver", icon: "camera", tone: "c" },
  { key: "board", href: "/lessons/interactive", icon: "board", tone: "v" },
  { key: "live", href: "/live", icon: "video", tone: "g" },
  { key: "exams", href: "/exams", icon: "exam", tone: "m" },
];

export function FeatureCards({ t }: { t: Messages["home"] }) {
  return (
    <section className="v2-section" aria-labelledby="v2-features-title">
      <div className="v2-sec-title">
        <h2 id="v2-features-title">{t.featuresTitle}</h2>
      </div>
      <ul className="v2-features">
        {FEATURES.map((feature) => {
          const copy = t.features[feature.key];
          return (
            <li key={feature.key}>
              <Link href={feature.href} className="v2-feature glass">
                <span className={`v2-ico ${feature.tone}`}>
                  <Icon name={feature.icon} size={20} />
                </span>
                <h3>{copy.title}</h3>
                <p>{copy.body}</p>
                <span className="v2-feature-go">
                  {copy.cta} <Icon name="arrow" size={16} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
