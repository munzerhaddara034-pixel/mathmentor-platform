import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MathServer } from "@/components/ui/MathServer";
import { FunctionGraph } from "@/components/v2/FunctionGraph";
import { AiTutorBadge } from "@/components/v2/AiTutorBadge";
import { TutorOrb } from "@/components/v2/TutorOrb";
import { rich } from "@/lib/i18n/rich";
import type { Messages } from "@/lib/i18n/messages/en";
import { buildGraph } from "@/lib/math/graph";
import { sampleExpression } from "@/lib/math/safeExpression";

const EXAMPLE = { expression: "(x-1)*exp(x)", tex: "f(x)=(x-1)e^{x}", from: -4, to: 2 } as const;

/** Static, clearly-labelled example (not user data): how a solver conversation reads, with its graph. */
export function DemoConversation({ m }: { m: Messages }) {
  const t = m.home;
  const points = sampleExpression(EXAMPLE.expression, EXAMPLE.from, EXAMPLE.to, 120);
  const graph = points ? buildGraph(points, 360, 200, 14, { yMin: -1.2, yMax: 3 }) : null;
  return (
    <section className="v2-section" aria-labelledby="v2-demo-title">
      <div className="v2-sec-title">
        <div>
          <h2 id="v2-demo-title">{t.demoTitle}</h2>
          <p className="v2-sec-lead">{t.demoLead}</p>
        </div>
        <Link href="/math-solver">{t.demoCta}</Link>
      </div>
      <div className="v2-demo">
        <div className="v2-demo-chat glass">
          <span className="v2-example-tag">{m.common.example}</span>
          <p className="v2-bub me">{rich(t.demoQuestion, { f: <MathServer tex={EXAMPLE.tex} /> })}</p>
          <p className="v2-ai-head">
            <TutorOrb mini /> {m.persona.name} <AiTutorBadge label={m.persona.ai} />
          </p>
          <div className="v2-bub ai">
            <p>{rich(t.demoAnswerA, { d: <MathServer tex="f'(x)=e^{x}+(x-1)e^{x}=x\,e^{x}" /> })}</p>
            <p>
              {rich(t.demoAnswerB, {
                x0: <MathServer tex="x=0" />,
                min: <MathServer tex="f(0)=-1" />,
              })}
            </p>
          </div>
          <div className="v2-demo-chips">
            <Link href="/math-solver" className="v2-chip">
              {t.demoChipWhy}
            </Link>
            <Link href="/lessons/interactive" className="v2-chip">
              <Icon name="board" size={16} /> {t.demoChipBoard}
            </Link>
          </div>
        </div>
        {graph ? (
          <div className="v2-demo-graph glass">
            <h3>{t.demoGraph}</h3>
            <FunctionGraph
              graph={graph}
              ariaLabel={`${t.demoGraph}: f(x) = (x − 1)·eˣ`}
              caption={
                <>
                  <MathServer tex={EXAMPLE.tex} /> · {t.demoGraphMin} <MathServer tex="(0\,;\,-1)" />
                </>
              }
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
