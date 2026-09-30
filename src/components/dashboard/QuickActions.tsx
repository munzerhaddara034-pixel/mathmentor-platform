"use client";

import Link from "next/link";
import { OPEN_ASSISTANT_EVENT } from "@/components/ChatWidget";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Icon, type IconName } from "@/components/ui/Icon";

type ActionKey = "solve" | "bank" | "exam";
const ACTIONS: { key: ActionKey; href: string; icon: IconName; tone: "g" | "v" | "r" }[] = [
  { key: "solve", href: "/math-solver", icon: "camera", tone: "g" },
  { key: "bank", href: "/practice", icon: "layers", tone: "v" },
  { key: "exam", href: "/exams", icon: "exam", tone: "r" },
];

export function QuickActions() {
  const { m } = useI18n();
  const t = m.dashboard;
  return (
    <section aria-labelledby="mm-quick">
      <h2 id="mm-quick" className="mm-dash-h2">
        {t.quickTitle}
      </h2>
      <div className="mm-quick">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href} className="mm-card mm-quick-item">
            <span className={`v2-ico ${action.tone}`}>
              <Icon name={action.icon} size={20} />
            </span>
            {t.quick[action.key]}
          </Link>
        ))}
        <button type="button" className="mm-card mm-quick-item" onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}>
          <span className="v2-ico c">
            <Icon name="chat" size={20} />
          </span>
          {t.quick.ask}
        </button>
      </div>
    </section>
  );
}
