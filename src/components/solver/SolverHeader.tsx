import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { BrandMark } from "@/components/nav/BrandMark";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import type { Messages } from "@/lib/i18n/messages/en";

/**
 * Solver page ترويسة (header): brand · tutor name + role · AI badge · compact locale switcher.
 * Design A: dark glass, orb accent. Mobile-first; brand and locale use logical CSS for RTL.
 */
export function SolverHeader({ m }: { m: Messages }) {
  const s = m.solver;
  return (
    <header className="v2-solver-masthead glass" aria-labelledby="v2-solver-title">
      <div className="v2-solver-masthead-top">
        <BrandMark href="/" />
        <LocaleSwitcher variant="inline" />
      </div>
      <div className="v2-solver-head">
        <TutorOrb size={48} />
        <div className="v2-solver-head-copy">
          <div className="v2-persona-line">
            <h1 id="v2-solver-title">{m.persona.name}</h1>
            <AiTutorBadge label={m.persona.ai} />
          </div>
          <p className="v2-solver-role">{m.persona.role}</p>
          <p className="v2-muted v2-small">
            <span className="v2-dot" aria-hidden="true" /> {s.subtitle}
          </p>
        </div>
      </div>
      <p className="sr-only">{m.persona.label}</p>
    </header>
  );
}
