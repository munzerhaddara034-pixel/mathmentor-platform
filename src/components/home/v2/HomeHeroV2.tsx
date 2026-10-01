import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MathServer } from "@/components/ui/MathServer";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import type { Messages } from "@/lib/i18n/messages/en";
import { AskBar } from "./AskBar";

/** Formula chips orbiting the tutor orb (decorative; math is LTR-isolated by MathServer). */
const ORBIT_CHIPS = [
  { tex: "\\sin^2\\theta+\\cos^2\\theta=1", cls: "c1" },
  { tex: "f'(x)=x\\,e^{x}", cls: "c2 d2" },
  { tex: "\\int_0^1 x^2\\,dx=\\frac{1}{3}", cls: "c3 d3" },
  { tex: "\\lim_{x\\to 2}\\frac{x^2-4}{x-2}=4", cls: "c4 d4" },
] as const;

export function HomeHeroV2({ m, signedIn }: { m: Messages; signedIn: boolean }) {
  const t = m.home;
  return (
    <section className="v2-hero" aria-labelledby="v2-hero-title">
      <div className="v2-hero-visual" aria-hidden="true">
        <TutorOrb rings />
        {ORBIT_CHIPS.map((chip) => (
          <span key={chip.tex} className={`v2-orbit-chip glass v2-float ${chip.cls}`}>
            <MathServer tex={chip.tex} />
          </span>
        ))}
      </div>
      <div className="v2-hero-copy">
        <span className="v2-persona-line">
          <span className="v2-chip">
            <span className="v2-dot" aria-hidden="true" /> {m.tutor.ready}
          </span>
          <AiTutorBadge label={m.persona.ai} />
        </span>
        <h1 id="v2-hero-title">
          {t.heroTitleA}
          <br />
          <span className="grad-text">{t.heroTitleB}</span>
        </h1>
        <p className="v2-hero-lead">{t.heroLead}</p>
        <AskBar t={t} />
        <div className="v2-hero-cta">
          {signedIn ? (
            <Link href="/dashboard" className="v2-btn v2-btn-glass">
              {t.ctaDashboard} <Icon name="arrow" size={18} />
            </Link>
          ) : (
            <Link href="/signup" className="v2-btn v2-btn-glass">
              {t.ctaStart} <Icon name="arrow" size={18} />
            </Link>
          )}
          <Link href="/live" className="v2-btn v2-btn-glass">
            <Icon name="video" size={18} /> {t.ctaBook}
          </Link>
        </div>
      </div>
    </section>
  );
}
